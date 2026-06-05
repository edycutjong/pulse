// ── Triage Core (platform-agnostic, no node:fs) ──────────────────────────────
// The real triage engine, shared by both the Node/CLI path (triage.ts, which
// feeds it interactions from the CSV) and the React Native app (which feeds it
// the bundled INTERACTIONS constant). Contains zero filesystem access so it
// bundles cleanly in Metro/Expo.

import { searchMedicalKnowledge } from "./rag";
import { runCompletion, LLAMA_MODEL_ID } from "./qvac";
import type { Interaction } from "./triageData";

export interface TriageResponse {
  triageLevel: "routine" | "urgent" | "emergency";
  assessment: string;
  drugInteractions: string[];
  likelyCauses: string[];
  recommendations: string[];
  watchFor: string[];
  sources: string[];
}

export interface MatchedInteraction {
  severity: string;
  note: string;
  src: string;
  drugA: string;
  drugB: string;
}

/**
 * Deterministically match the symptom query + saved meds against a list of
 * known interactions. Pure — the caller supplies the interaction list (CSV on
 * Node, bundled constant on mobile).
 */
export function matchInteractions(
  query: string,
  userMeds: string[],
  interactions: Interaction[]
): MatchedInteraction[] {
  const found: MatchedInteraction[] = [];
  const lowerQuery = query.toLowerCase();
  const lowerMeds = userMeds.map((m) => m.toLowerCase());

  for (const inter of interactions) {
    const drugA = inter.a.toLowerCase();
    const drugB = inter.b.toLowerCase();

    // One drug in the query and the other in the user's medication list.
    const match1 = lowerQuery.includes(drugA) && lowerMeds.includes(drugB);
    const match2 = lowerQuery.includes(drugB) && lowerMeds.includes(drugA);

    if (match1 || match2) {
      found.push({ severity: inter.severity, note: inter.note, src: inter.src, drugA, drugB });
    }
  }

  return found;
}

/**
 * Run conservative triage: local RAG + deterministic interaction check + MedPsy
 * completion, with a structured-JSON contract and a safety fallback if parsing
 * fails. `interactions` is injected so this stays filesystem-free.
 */
export async function runTriageCore(
  query: string,
  userMeds: string[],
  interactions: Interaction[],
  useModelId: any = LLAMA_MODEL_ID
): Promise<TriageResponse> {
  // 1. Search knowledge base
  const knowledge = await searchMedicalKnowledge(query, 4);
  const contextText = knowledge
    .map((k, i) => `[Document ${i + 1}]: ${k.content} (Source: ${k.source})`)
    .join("\n\n");

  // 2. Check local drug interactions
  const localInteractions = matchInteractions(query, userMeds, interactions);
  const localInteractionWarnings = localInteractions.map(
    (inter) =>
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
    { role: "user" as const, content: `Symptom report: "${query}"` },
  ];

  let finalResponse: TriageResponse;

  try {
    const response = await runCompletion({ modelId: useModelId, history, stream: false });

    const parsed = JSON.parse(response.text.trim());

    // Inject local database check results if LLM missed them
    if (localInteractions.length > 0 && parsed.drugInteractions.length === 0) {
      parsed.drugInteractions = localInteractionWarnings;
      parsed.triageLevel = "urgent"; // interactions are urgent
      localInteractions.forEach((i) => {
        if (!parsed.sources.includes(i.src)) {
          parsed.sources.push(i.src);
        }
      });
    }

    // Ensure sources are listed
    if (parsed.sources.length === 0) {
      parsed.sources = knowledge.map((k) => k.source);
    }

    finalResponse = parsed;
  } catch (error) {
    console.warn("Failed to parse LLM response as JSON, falling back to structured regex parser:", error);

    // Safety Fallback Response
    const lowerQuery = query.toLowerCase();
    const isEmergency = lowerQuery.includes("chest pain") && lowerQuery.includes("arm");
    const isUrgent =
      (lowerQuery.includes("headache") && lowerQuery.includes("blur")) || localInteractions.length > 0;

    finalResponse = {
      triageLevel: isEmergency ? "emergency" : isUrgent ? "urgent" : "routine",
      assessment: "Symptom report received. Triage determined using conservative fallback logic.",
      drugInteractions: localInteractionWarnings,
      likelyCauses: isEmergency
        ? ["Possible cardiac event"]
        : isUrgent
        ? ["Hypertensive risk / Medication interaction"]
        : ["Mild symptom review"],
      recommendations: ["Ensure safe environment.", "Prepare a list of active medications.", "Consult a healthcare provider."],
      watchFor: ["Worsening headache", "Chest pain", "Shortness of breath", "Dizziness"],
      sources: ["fallback-clinical-protocol", ...localInteractions.map((i) => i.src)],
    };
  }

  return finalResponse;
}
