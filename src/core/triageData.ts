// ── Bundled Drug-Interaction Data ────────────────────────────────────────────
// Mirror of data/fixtures/interactions.csv as a bundled constant so the mobile
// app (React Native / Expo) can run the real triage engine without node:fs.
// The Node/CLI path still reads the CSV via triage.ts; both share triageCore.

export interface Interaction {
  a: string;
  b: string;
  severity: string;
  note: string;
  src: string;
}

export const INTERACTIONS: Interaction[] = [
  { a: "warfarin", b: "ibuprofen", severity: "high", note: "Increased risk of bleeding; NSAIDs inhibit platelet function and may displace warfarin from protein binding", src: "interaction/warfarin-nsaid" },
  { a: "warfarin", b: "aspirin", severity: "high", note: "Dual anticoagulant/antiplatelet effect increases hemorrhage risk significantly", src: "interaction/warfarin-aspirin" },
  { a: "amlodipine", b: "ibuprofen", severity: "moderate", note: "NSAIDs may reduce antihypertensive effect and increase risk of kidney impairment", src: "interaction/ccb-nsaid" },
  { a: "metformin", b: "alcohol", severity: "moderate", note: "Alcohol potentiates lactic acidosis risk; monitor blood glucose closely", src: "interaction/metformin-alcohol" },
  { a: "lisinopril", b: "potassium", severity: "high", note: "ACE inhibitors reduce potassium excretion; combined supplementation risks hyperkalemia", src: "interaction/acei-potassium" },
  { a: "simvastatin", b: "grapefruit", severity: "moderate", note: "Grapefruit inhibits CYP3A4 metabolism; can increase statin blood levels 2-5x", src: "interaction/statin-grapefruit" },
  { a: "methotrexate", b: "ibuprofen", severity: "high", note: "NSAIDs reduce renal clearance of methotrexate; risk of severe toxicity", src: "interaction/mtx-nsaid" },
  { a: "digoxin", b: "amiodarone", severity: "high", note: "Amiodarone increases digoxin levels by 70-100%; requires dose reduction", src: "interaction/digoxin-amiodarone" },
  { a: "lithium", b: "ibuprofen", severity: "high", note: "NSAIDs reduce renal lithium clearance; serum levels can rise to toxic range", src: "interaction/lithium-nsaid" },
  { a: "fluoxetine", b: "tramadol", severity: "high", note: "Serotonin syndrome risk; both increase serotonergic activity", src: "interaction/ssri-tramadol" },
  { a: "clopidogrel", b: "omeprazole", severity: "moderate", note: "Omeprazole inhibits CYP2C19 activation of clopidogrel; reduced antiplatelet effect", src: "interaction/clopidogrel-ppi" },
  { a: "ciprofloxacin", b: "antacids", severity: "moderate", note: "Divalent cations in antacids chelate fluoroquinolones; reduces absorption by 90%", src: "interaction/fluoroquinolone-antacid" },
  { a: "insulin", b: "beta_blockers", severity: "moderate", note: "Beta-blockers mask hypoglycemia symptoms (tremor, tachycardia); delayed recognition", src: "interaction/insulin-betablocker" },
  { a: "theophylline", b: "erythromycin", severity: "high", note: "Erythromycin inhibits theophylline metabolism; risk of seizures and arrhythmias", src: "interaction/theophylline-macrolide" },
  { a: "phenytoin", b: "valproate", severity: "high", note: "Valproate displaces phenytoin from protein binding and inhibits metabolism", src: "interaction/phenytoin-valproate" },
  { a: "sildenafil", b: "nitrates", severity: "critical", note: "Severe hypotension risk; combination is absolutely contraindicated", src: "interaction/pde5-nitrate" },
  { a: "potassium", b: "spironolactone", severity: "high", note: "Dual potassium-sparing effect; life-threatening hyperkalemia possible", src: "interaction/potassium-sparing" },
  { a: "metformin", b: "contrast_dye", severity: "high", note: "Iodinated contrast impairs renal function; metformin accumulation causes lactic acidosis", src: "interaction/metformin-contrast" },
  { a: "ssri", b: "maoi", severity: "critical", note: "Serotonin syndrome — potentially fatal; minimum 14-day washout required", src: "interaction/ssri-maoi" },
  { a: "carbamazepine", b: "oral_contraceptives", severity: "high", note: "Carbamazepine induces CYP3A4; reduces contraceptive efficacy significantly", src: "interaction/carbamazepine-ocp" },
  { a: "aspirin", b: "amlodipine", severity: "low", note: "Minor interaction; aspirin may slightly reduce antihypertensive effect", src: "interaction/aspirin-ccb" },
  { a: "acetaminophen", b: "warfarin", severity: "moderate", note: "Chronic acetaminophen use (>2g/day) can increase INR; occasional use is safe", src: "interaction/acetaminophen-warfarin" },
];
