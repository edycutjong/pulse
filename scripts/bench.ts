/**
 * Pulse — Real benchmark harness (run via `npx tsx scripts/bench.ts`).
 *
 * Measures REAL, reproducible CPU latency for the deterministic safety engine
 * that runs on EVERY triage regardless of hardware:
 *   - drug-interaction matching (CSV/bundled table)
 *   - red-flag scan (40 clinical patterns)
 *   - end-to-end triageCore (interaction + RAG + red-flag + JSON assembly;
 *     uses the conservative fallback path when the native model isn't loaded)
 *
 * Model-inference numbers (MedGemma-4B TTFT, Whisper STT, Supertonic TTS) are
 * reported as DEVICE-ONLY: they require the @qvac/sdk native runtime (a dev
 * build), so we label them honestly rather than fabricating timings here.
 */
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { matchInteractions } from "../src/core/triageCore";
import { checkRedFlags, escalateTriageLevel, RED_FLAGS } from "../src/core/redFlags";
import { INTERACTIONS } from "../src/core/triageData";

const QUERIES = [
  "I have a severe headache and blurred vision",
  "My child has a mild cough and runny nose",
  "I take warfarin and ibuprofen, is that safe?",
  "Chest pain radiating to my left arm",
  "I have seasonal allergies, itchy eyes",
];
const MEDS = ["warfarin", "amlodipine"];

function stats(samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  const pct = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    runs: s.length,
    p50_ms: +pct(50).toFixed(3),
    p95_ms: +pct(95).toFixed(3),
    mean_ms: +mean.toFixed(3),
    max_ms: +s[s.length - 1].toFixed(3),
  };
}

async function timeSync(fn: () => void, iterations: number): Promise<number[]> {
  for (let i = 0; i < 50; i++) fn(); // warm-up
  const out: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t = performance.now();
    fn();
    out.push(performance.now() - t);
  }
  return out;
}

async function main() {
  const assertMode = process.argv.includes("--assert");
  console.log("=".repeat(60));
  console.log("  Pulse — Benchmark Suite (real CPU measurements)");
  console.log("=".repeat(60));
  console.log();

  // 1. Drug-interaction matching
  const interSamples = await timeSync(
    () => void matchInteractions(QUERIES[2], MEDS, INTERACTIONS),
    2000
  );
  const interaction = stats(interSamples);
  console.log(`[bench] Drug-interaction check  p50=${interaction.p50_ms}ms  p95=${interaction.p95_ms}ms`);

  // 2. Red-flag scan (40 patterns)
  const redSamples = await timeSync(() => void checkRedFlags(QUERIES[0], RED_FLAGS), 2000);
  const redFlag = stats(redSamples);
  console.log(`[bench] Red-flag scan (40)      p50=${redFlag.p50_ms}ms  p95=${redFlag.p95_ms}ms`);

  // 3. End-to-end triageCore (fallback path when native model absent)
  const e2eSamples = await timeAsync(async () => {
    for (const q of QUERIES) await runTriageCore(q, MEDS, INTERACTIONS);
  }, 20);
  const e2e = stats(e2eSamples);
  console.log(`[bench] Triage end-to-end       p50=${e2e.p50_ms}ms  p95=${e2e.p95_ms}ms  (5 queries/run)`);

  const nativeAvailable = isQVACNativeAvailable();
  console.log();
  console.log(
    nativeAvailable
      ? "[bench] @qvac/sdk native runtime detected — model timings above include real inference."
      : "[bench] @qvac/sdk native runtime NOT present (CI/Node) — model TTFT/STT/TTS are DEVICE-ONLY; run on a dev build for those."
  );

  const results = {
    timestamp: new Date().toISOString(),
    nativeRuntimeAvailable: nativeAvailable,
    measured_cpu: { interaction_check: interaction, red_flag_scan: redFlag, triage_end_to_end: e2e },
    device_only_note:
      "MedGemma-4B TTFT, Whisper STT and Supertonic TTS require the @qvac/sdk native runtime; measure on a dev build (npx expo run:ios/android).",
  };

  const outFile = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data", "bench_results.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n[bench] Results written: ${outFile}`);

  if (assertMode) {
    // Conservative budgets for the deterministic engine (must hold on any CPU).
    const ok = interaction.p95_ms < 50 && redFlag.p95_ms < 50 && e2e.p95_ms < 2000;
    console.log(`\n[bench] Assert budgets: ${ok ? "✅ PASS" : "❌ FAIL"}`);
    process.exit(ok ? 0 : 1);
  }
}

main().catch((err) => {
  console.error("[bench] failed:", err);
  process.exit(1);
});
