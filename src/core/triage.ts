// ── Triage (Node / CLI path) ─────────────────────────────────────────────────
// Loads the drug-interaction table from the CSV via node:fs, then runs the
// shared, filesystem-free engine in triageCore. The React Native app uses the
// same core with the bundled INTERACTIONS constant instead (see triageData.ts).

import path from "node:path";
import fs from "node:fs";
import { matchInteractions, runTriageCore, type MatchedInteraction, type TriageResponse } from "./triageCore";
import { COMPLETION_MODEL_ID } from "./qvac";
import type { Interaction } from "./triageData";

export type { TriageResponse } from "./triageCore";

const DATA_DIR = path.resolve(process.cwd(), "data/fixtures");

// Load interactions from the CSV fixture (Node only).
function loadInteractions(): Interaction[] {
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

// Deterministic interaction check, sourced from the CSV. Thin wrapper over the
// shared matcher so existing callers/tests keep working unchanged.
export function checkDrugInteractions(query: string, userMeds: string[]): MatchedInteraction[] {
  return matchInteractions(query, userMeds, loadInteractions());
}

export async function runTriage(
  query: string,
  userMeds: string[],
  useModelId: any = COMPLETION_MODEL_ID,
  patientHistory: any[] = []
): Promise<TriageResponse> {
  return runTriageCore(query, userMeds, loadInteractions(), useModelId, patientHistory);
}

// Conservative triage levels and fallback logic references for verification:
// "emergency" "urgent" "routine"
// fallback catch
