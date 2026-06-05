import path from "node:path";
import fs from "node:fs";
import { searchMedicalKnowledge } from "./rag";
import { runCompletion, MEDPSY_MODEL_ID, LLAMA_MODEL_ID } from "./qvac";

export interface TriageResponse {
  triageLevel: "routine" | "urgent" | "emergency";
  assessment: string;
  drugInteractions: string[];
  likelyCauses: string[];
  recommendations: string[];
  watchFor: string[];
  sources: string[];
}

const DATA_DIR = path.resolve(process.cwd(), "data/fixtures");

// Local helper to load interactions
function loadInteractions(): { a: string; b: string; severity: string; note: string; src: string }[] {
  const filepath = path.join(DATA_DIR, "interactions.csv");
  if (!fs.existsSync(filepath)) return [];
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n").map((l: string) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h: string) => h.trim().replace(/^"|"$/g, ""));
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c: string) => c.trim().replace(/^"|"$/g, ""));
    const row: any = {};
    headers.forEach((h: string, index: number) => {
      let key = h;
      if (h === "drug_a") key = "a";
      if (h === "drug_b") key = "b";
      row[key] = cells[index] || "";
    });
    rows.push(row);
  }
  return rows;
}

// Local helper to check interactions deterministically
export function checkDrugInteractions(query: string, userMeds: string[]): { severity: string; note: string; src: string; drugA: string; drugB: string }[] {
  const interactions = loadInteractions();
  const found: any[] = [];

  const lowerQuery = query.toLowerCase();
  const lowerMeds = userMeds.map(m => m.toLowerCase());

  for (const inter of interactions) {
    const drugA = inter.a.toLowerCase();
    const drugB = inter.b.toLowerCase();

    // Check if one drug is in query and the other is in user medications
    const match1 = lowerQuery.includes(drugA) && lowerMeds.includes(drugB);
    const match2 = lowerQuery.includes(drugB) && lowerMeds.includes(drugA);

    if (match1 || match2) {
      found.push({
        severity: inter.severity,
        note: inter.note,
        src: inter.src,
        drugA: drugA,
        drugB: drugB
      });
    }
  }

  return found;
}

export async function runTriage(query: string, userMeds: string[], useModelId: any = LLAMA_MODEL_ID): Promise<TriageResponse> {
  // 1. Search knowledge base
  const knowledge = await searchMedicalKnowledge(query, 4);
  const contextText = knowledge.map((k, i) => `[Document ${i + 1}]: ${k.content} (Source: ${k.source})`).join("\n\n");

  // 2. Check local drug interactions
  const localInteractions = checkDrugInteractions(query, userMeds);
  const localInteractionWarnings = localInteractions.map(inter => 
    `WARNING: ${inter.drugA} and ${inter.drugB} have a ${inter.severity} interaction. Note: ${inter.note} [Source: ${inter.src}]`
  );

  // 3. Assemble prompt
  const systemPrompt = `You are an elite, highly conservative clinical decision-support AI named Pulse. 
Your goal is to triage the user's symptoms based ONLY on the provided medical protocols and medication lists.
You do NOT diagnose. You assess risk, flag interactions, suggest triage urgency, and list warnings.

CRITICAL INSTRUCTIONS:
- Triage levels must be strictly: "routine", "urgent", or "emergency".
- "emergency": Immediate life-threatening signs (e.g. radiating chest pain, severe breathing loss).
- "urgent": Potential serious conditions requiring rapid clinical review (e.g. severe headache + blurred vision in a patient taking blood pressure medications).
- "routine": Mild self-limiting symptoms with no red flags (e.g. mild cold, no fever).
- If there is any doubt or contradiction, always default to the more conservative/urgent level.
- You must verify drug interactions. Highlight any interactions between medications in the symptom query and the user's saved medications.
- Cite your sources using the format [Source: source_id] corresponding to the protocols provided.

SAVED USER MEDICATIONS:
${userMeds.join(", ") || "None"}

CONFIRMED DRUG INTERACTIONS (from database):
${localInteractionWarnings.join("\n") || "None detected in database."}

MEDICAL PROTOCOLS (RAG):
${contextText || "No matching medical protocols found."}

FORMAT REQUIREMENT:
You must reply ONLY with a valid JSON object matching the following structure:
{
  "triageLevel": "routine" | "urgent" | "emergency",
  "assessment": "2-sentence clinical assessment of the symptoms and risk.",
  "drugInteractions": ["List of identified drug interaction warnings."],
  "likelyCauses": ["Possible classifications based on guidelines."],
  "recommendations": ["Safe, non-prescription instructions, e.g. rest, consult clinic."],
  "watchFor": ["Specific red flags that should cause escalation."],
  "sources": ["List of cited sources (e.g. escalation/headache-redflags)"]
}`;

  const history = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: `Symptom report: "${query}"` }
  ];

  let finalResponse: TriageResponse;

  try {
    const response = await runCompletion({
      modelId: useModelId,
      history,
      stream: false
    });

    const parsed = JSON.parse(response.text.trim());
    
    // Inject local database check results if LLM missed them
    if (localInteractions.length > 0 && parsed.drugInteractions.length === 0) {
      parsed.drugInteractions = localInteractionWarnings;
      parsed.triageLevel = "urgent"; // interactions are urgent
      localInteractions.forEach(i => {
        if (!parsed.sources.includes(i.src)) {
          parsed.sources.push(i.src);
        }
      });
    }

    // Ensure sources are listed
    if (parsed.sources.length === 0) {
      parsed.sources = knowledge.map(k => k.source);
    }

    finalResponse = parsed;
  } catch (error) {
    console.warn("Failed to parse LLM response as JSON, falling back to structured regex parser:", error);
    
    // Safety Fallback Response
    const lowerQuery = query.toLowerCase();
    const isEmergency = lowerQuery.includes("chest pain") && lowerQuery.includes("arm");
    const isUrgent = (lowerQuery.includes("headache") && lowerQuery.includes("blur")) || localInteractions.length > 0;

    finalResponse = {
      triageLevel: isEmergency ? "emergency" : isUrgent ? "urgent" : "routine",
      assessment: "Symptom report received. Triage determined using conservative fallback logic.",
      drugInteractions: localInteractionWarnings,
      likelyCauses: isEmergency ? ["Possible cardiac event"] : isUrgent ? ["Hypertensive risk / Medication interaction"] : ["Mild symptom review"],
      recommendations: ["Ensure safe environment.", "Prepare a list of active medications.", "Consult a healthcare provider."],
      watchFor: ["Worsening headache", "Chest pain", "Shortness of breath", "Dizziness"],
      sources: ["fallback-clinical-protocol", ...localInteractions.map(i => i.src)]
    };
  }

  return finalResponse;
}
