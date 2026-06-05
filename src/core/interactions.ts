// ── Drug-interaction table (bundled, RN-safe) ────────────────────────────────
// Embedded so the table works on a phone (React Native has no node:fs).
// Mirrors data/fixtures/interactions.csv — keep the two in sync.

export interface InteractionRow {
  a: string;
  b: string;
  severity: string;
  note: string;
  src: string;
}

export const INTERACTIONS_CSV = `drug_a,drug_b,severity,note,src
warfarin,ibuprofen,high,"Increased risk of bleeding; NSAIDs inhibit platelet function and may displace warfarin from protein binding",interaction/warfarin-nsaid
warfarin,aspirin,high,"Dual anticoagulant/antiplatelet effect increases hemorrhage risk significantly",interaction/warfarin-aspirin
amlodipine,ibuprofen,moderate,"NSAIDs may reduce antihypertensive effect and increase risk of kidney impairment",interaction/ccb-nsaid
metformin,alcohol,moderate,"Alcohol potentiates lactic acidosis risk; monitor blood glucose closely",interaction/metformin-alcohol
lisinopril,potassium,high,"ACE inhibitors reduce potassium excretion; combined supplementation risks hyperkalemia",interaction/acei-potassium
simvastatin,grapefruit,moderate,"Grapefruit inhibits CYP3A4 metabolism; can increase statin blood levels 2-5x",interaction/statin-grapefruit
methotrexate,ibuprofen,high,"NSAIDs reduce renal clearance of methotrexate; risk of severe toxicity",interaction/mtx-nsaid
digoxin,amiodarone,high,"Amiodarone increases digoxin levels by 70-100%; requires dose reduction",interaction/digoxin-amiodarone
lithium,ibuprofen,high,"NSAIDs reduce renal lithium clearance; serum levels can rise to toxic range",interaction/lithium-nsaid
fluoxetine,tramadol,high,"Serotonin syndrome risk; both increase serotonergic activity",interaction/ssri-tramadol
clopidogrel,omeprazole,moderate,"Omeprazole inhibits CYP2C19 activation of clopidogrel; reduced antiplatelet effect",interaction/clopidogrel-ppi
ciprofloxacin,antacids,moderate,"Divalent cations in antacids chelate fluoroquinolones; reduces absorption by 90%",interaction/fluoroquinolone-antacid
insulin,beta_blockers,moderate,"Beta-blockers mask hypoglycemia symptoms (tremor, tachycardia); delayed recognition",interaction/insulin-betablocker
theophylline,erythromycin,high,"Erythromycin inhibits theophylline metabolism; risk of seizures and arrhythmias",interaction/theophylline-macrolide
phenytoin,valproate,high,"Valproate displaces phenytoin from protein binding and inhibits metabolism",interaction/phenytoin-valproate
sildenafil,nitrates,critical,"Severe hypotension risk; combination is absolutely contraindicated",interaction/pde5-nitrate
potassium,spironolactone,high,"Dual potassium-sparing effect; life-threatening hyperkalemia possible",interaction/potassium-sparing
metformin,contrast_dye,high,"Iodinated contrast impairs renal function; metformin accumulation causes lactic acidosis",interaction/metformin-contrast
ssri,maoi,critical,"Serotonin syndrome — potentially fatal; minimum 14-day washout required",interaction/ssri-maoi
carbamazepine,oral_contraceptives,high,"Carbamazepine induces CYP3A4; reduces contraceptive efficacy significantly",interaction/carbamazepine-ocp
aspirin,amlodipine,low,"Minor interaction; aspirin may slightly reduce antihypertensive effect",interaction/aspirin-ccb
acetaminophen,warfarin,moderate,"Chronic acetaminophen use (>2g/day) can increase INR; occasional use is safe",interaction/acetaminophen-warfarin`;

/** Split one CSV line, respecting double-quoted fields (which may contain commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Parse interactions CSV text into rows. `drug_a`/`drug_b` headers map to `a`/`b`. */
export function parseInteractionsCsv(content: string): InteractionRow[] {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const rows: InteractionRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, index) => {
      let key = h;
      if (h === "drug_a") key = "a";
      if (h === "drug_b") key = "b";
      row[key] = cells[index] ?? "";
    });
    rows.push({
      a: row.a ?? "",
      b: row.b ?? "",
      severity: row.severity ?? "",
      note: row.note ?? "",
      src: row.src ?? "",
    });
  }
  return rows;
}

/** The bundled interaction table, parsed once. */
export const INTERACTIONS: InteractionRow[] = parseInteractionsCsv(INTERACTIONS_CSV);
