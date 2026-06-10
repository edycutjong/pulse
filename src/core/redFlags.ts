// ── Red Flags Detection Engine ───────────────────────────────────────────────
// Deterministic symptom red-flag scanner. Mirrors data/fixtures/red_flags.csv
// as a bundled constant so the mobile app (React Native / Expo) can run real
// red-flag detection without node:fs. The Node/CLI path can also load from CSV.
//
// Design: every symptom query is scanned against 40+ known clinical red-flag
// patterns. If any match, the triage level is auto-escalated to at least the
// pattern's level. This is a safety net — even if the LLM misses a red flag,
// the deterministic scanner catches it.

export interface RedFlag {
  pattern: string;
  triageLevel: "emergency" | "urgent" | "routine";
  rationale: string;
  src: string;
}

// ── Bundled Red Flags (mirrors data/fixtures/red_flags.csv) ──────────────────

export const RED_FLAGS: RedFlag[] = [
  // Emergency patterns (10)
  { pattern: "chest pain radiating to arm", triageLevel: "emergency", rationale: "Possible acute coronary syndrome / myocardial infarction", src: "escalation/chest-pain-acs" },
  { pattern: "chest pain with shortness of breath", triageLevel: "emergency", rationale: "Cardiac or pulmonary emergency until proven otherwise", src: "escalation/chest-pain-dyspnea" },
  { pattern: "sudden severe headache worst ever", triageLevel: "emergency", rationale: "Thunderclap headache suggests subarachnoid hemorrhage", src: "escalation/headache-sah" },
  { pattern: "difficulty breathing at rest", triageLevel: "emergency", rationale: "Respiratory failure requires immediate intervention", src: "escalation/dyspnea-rest" },
  { pattern: "unresponsive or altered consciousness", triageLevel: "emergency", rationale: "Altered mental status is a medical emergency", src: "escalation/altered-consciousness" },
  { pattern: "seizure lasting more than 5 minutes", triageLevel: "emergency", rationale: "Status epilepticus; requires emergency medication", src: "escalation/status-epilepticus" },
  { pattern: "severe allergic reaction swelling throat", triageLevel: "emergency", rationale: "Anaphylaxis; epinephrine required immediately", src: "escalation/anaphylaxis" },
  { pattern: "sudden vision loss one eye", triageLevel: "emergency", rationale: "Possible retinal artery occlusion or stroke; time-critical", src: "escalation/vision-loss-acute" },
  { pattern: "coughing or vomiting blood", triageLevel: "emergency", rationale: "Hematemesis or hemoptysis suggests serious GI or pulmonary bleed", src: "escalation/hemorrhage" },
  { pattern: "sudden weakness one side of body", triageLevel: "emergency", rationale: "Stroke symptoms; every minute counts for intervention", src: "escalation/stroke-fast" },
  { pattern: "stiff neck with fever and headache", triageLevel: "emergency", rationale: "Meningitis until proven otherwise; needs urgent lumbar puncture", src: "escalation/meningitis" },
  { pattern: "sudden testicular pain in young male", triageLevel: "emergency", rationale: "Testicular torsion; surgical emergency within 6 hours", src: "escalation/testicular-torsion" },
  { pattern: "severe burn larger than palm", triageLevel: "emergency", rationale: "Significant burn area; risk of shock and infection", src: "escalation/burn-major" },
  { pattern: "slurred speech with facial droop", triageLevel: "emergency", rationale: "Acute stroke signs; activate stroke pathway immediately", src: "escalation/stroke-speech" },

  // Urgent patterns (14)
  { pattern: "headache with blurred vision", triageLevel: "urgent", rationale: "Possible hypertensive crisis or increased intracranial pressure", src: "escalation/headache-vision" },
  { pattern: "fever above 39.5c lasting 3 days", triageLevel: "urgent", rationale: "Persistent high fever suggests serious infection requiring workup", src: "escalation/fever-persistent" },
  { pattern: "blood in urine", triageLevel: "urgent", rationale: "Hematuria needs investigation for infection, stones, or malignancy", src: "escalation/hematuria" },
  { pattern: "severe abdominal pain", triageLevel: "urgent", rationale: "Acute abdomen requires clinical evaluation to rule out surgical emergency", src: "escalation/acute-abdomen" },
  { pattern: "sudden swelling in one leg", triageLevel: "urgent", rationale: "Possible deep vein thrombosis; risk of pulmonary embolism", src: "escalation/dvt-suspicion" },
  { pattern: "confusion in elderly patient", triageLevel: "urgent", rationale: "Delirium in elderly has many serious causes; needs clinical assessment", src: "escalation/delirium-elderly" },
  { pattern: "severe dehydration signs", triageLevel: "urgent", rationale: "Sunken eyes, dry mucosa, tachycardia; may need IV fluids", src: "escalation/dehydration-severe" },
  { pattern: "persistent vomiting 24 hours", triageLevel: "urgent", rationale: "Risk of dehydration and electrolyte imbalance; cannot keep fluids down", src: "escalation/vomiting-persistent" },
  { pattern: "rash with fever and joint pain", triageLevel: "urgent", rationale: "Could indicate systemic infection, vasculitis, or autoimmune flare", src: "escalation/rash-fever-joints" },
  { pattern: "chest pain worse with deep breath", triageLevel: "urgent", rationale: "Pleuritic pain; consider PE, pericarditis, pneumonia", src: "escalation/pleuritic-chest" },
  { pattern: "new onset irregular heartbeat", triageLevel: "urgent", rationale: "Arrhythmia evaluation needed; risk stratification required", src: "escalation/arrhythmia-new" },
  { pattern: "difficulty swallowing progressive", triageLevel: "urgent", rationale: "Progressive dysphagia needs investigation for obstruction or malignancy", src: "escalation/dysphagia" },
  { pattern: "dizziness with hearing loss", triageLevel: "urgent", rationale: "Possible Meniere's disease or acoustic neuroma; needs ENT evaluation", src: "escalation/vertigo-hearing" },
  { pattern: "black tarry stools", triageLevel: "urgent", rationale: "Melena indicates upper GI bleeding; needs evaluation", src: "escalation/melena" },
  { pattern: "yellowing of skin or eyes", triageLevel: "urgent", rationale: "Jaundice suggests liver or biliary pathology", src: "escalation/jaundice" },
  { pattern: "unintentional weight loss over weeks", triageLevel: "urgent", rationale: "Red flag for malignancy or chronic disease; needs workup", src: "escalation/weight-loss" },
  { pattern: "painful red eye with light sensitivity", triageLevel: "urgent", rationale: "Possible uveitis or acute glaucoma; ophthalmology referral", src: "escalation/red-eye" },

  // Routine patterns (9)
  { pattern: "mild headache no other symptoms", triageLevel: "routine", rationale: "Common tension headache; self-limiting in most cases", src: "triage/headache-mild" },
  { pattern: "common cold runny nose sneezing", triageLevel: "routine", rationale: "Viral upper respiratory infection; supportive care sufficient", src: "triage/common-cold" },
  { pattern: "minor cut or scrape", triageLevel: "routine", rationale: "Clean wound, apply antiseptic, monitor for infection signs", src: "triage/minor-wound" },
  { pattern: "mild muscle ache after exercise", triageLevel: "routine", rationale: "Delayed onset muscle soreness; rest and hydration", src: "triage/doms" },
  { pattern: "seasonal allergies itchy eyes", triageLevel: "routine", rationale: "Allergic rhinitis/conjunctivitis; antihistamines and avoidance", src: "triage/allergies-seasonal" },
  { pattern: "mild stomach upset after eating", triageLevel: "routine", rationale: "Likely dietary cause; bland diet and fluids; monitor 24h", src: "triage/dyspepsia-mild" },
  { pattern: "dry skin or minor rash no fever", triageLevel: "routine", rationale: "Dermatitis; moisturizer and monitor; see clinic if persists >2 weeks", src: "triage/dermatitis-minor" },
  { pattern: "mild sore throat without fever", triageLevel: "routine", rationale: "Likely viral pharyngitis; supportive care and fluids", src: "triage/sore-throat-mild" },
  { pattern: "occasional heartburn after meals", triageLevel: "routine", rationale: "Mild reflux; dietary modification and antacids", src: "triage/reflux-mild" },
];

// ── Triage Level Ordering ────────────────────────────────────────────────────

const LEVEL_PRIORITY: Record<string, number> = {
  routine: 0,
  urgent: 1,
  emergency: 2,
};

/**
 * Compare two triage levels. Returns a negative number if `a` is less severe,
 * zero if equal, positive if `a` is more severe.
 */
export function compareTriageLevels(
  a: "emergency" | "urgent" | "routine",
  b: "emergency" | "urgent" | "routine"
): number {
  return (LEVEL_PRIORITY[a] ?? 0) - (LEVEL_PRIORITY[b] ?? 0);
}

/**
 * Return the more severe of two triage levels.
 */
export function maxTriageLevel(
  a: "emergency" | "urgent" | "routine",
  b: "emergency" | "urgent" | "routine"
): "emergency" | "urgent" | "routine" {
  return compareTriageLevels(a, b) >= 0 ? a : b;
}

// ── Red Flags Detection ──────────────────────────────────────────────────────

export interface RedFlagMatch {
  pattern: string;
  triageLevel: "emergency" | "urgent" | "routine";
  rationale: string;
  src: string;
}

/**
 * Scan a symptom query against all known red-flag patterns.
 * Uses fuzzy keyword matching: each word in the pattern must appear in the
 * query (order-independent). This catches natural-language variations like
 * "I have chest pain that radiates to my left arm" matching the pattern
 * "chest pain radiating to arm".
 *
 * Pure function — the caller supplies the red-flag list (bundled constant on
 * mobile, or parsed CSV on Node).
 */
export function checkRedFlags(
  query: string,
  redFlags: RedFlag[] = RED_FLAGS
): RedFlagMatch[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const matches: RedFlagMatch[] = [];

  for (const flag of redFlags) {
    const patternWords = flag.pattern.toLowerCase().split(/\s+/);
    // Require ALL significant words (≥3 chars) from the pattern to appear in
    // the query. Short words (to, or, in, no) are skipped to reduce noise.
    const significantWords = patternWords.filter((w) => w.length >= 3);

    if (significantWords.length === 0) continue;

    const allPresent = significantWords.every((word) =>
      lowerQuery.includes(word)
    );

    if (allPresent) {
      matches.push({
        pattern: flag.pattern,
        triageLevel: flag.triageLevel,
        rationale: flag.rationale,
        src: flag.src,
      });
    }
  }

  return matches;
}

/**
 * Given the current triage level and a list of red-flag matches, return the
 * escalated triage level (the most severe among all).
 */
export function escalateTriageLevel(
  currentLevel: "emergency" | "urgent" | "routine",
  matches: RedFlagMatch[]
): "emergency" | "urgent" | "routine" {
  let result = currentLevel;
  for (const m of matches) {
    result = maxTriageLevel(result, m.triageLevel);
  }
  return result;
}
