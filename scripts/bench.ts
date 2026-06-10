/**
 * Pulse — Real benchmark harness (run via `npx tsx scripts/bench.ts`).
 *
 * Measures REAL, reproducible CPU latency for the deterministic safety engine
 * that runs on EVERY triage regardless of hardware:
 *   - drug-interaction matching (CSV/bundled table)
 *   - red-flag scan (40 clinical patterns)
 *   - combined safety pass (interaction + red-flag + escalation across all
 *     5 queries — the full non-LLM safety layer that runs before any model)
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

  // 3. Combined deterministic safety pass (interaction + red-flag + escalation)
  //    This is the full non-LLM safety layer that runs on EVERY triage, for all
  //    5 queries, before any model is consulted. Pure CPU — no SDK calls.
  const safetySamples = await timeSync(() => {
    for (const q of QUERIES) {
      matchInteractions(q, MEDS, INTERACTIONS);
      const flags = checkRedFlags(q, RED_FLAGS);
      escalateTriageLevel("routine", flags);
    }
  }, 2000);
  const safety = stats(safetySamples);
  console.log(`[bench] Combined safety pass    p50=${safety.p50_ms}ms  p95=${safety.p95_ms}ms  (5 queries/run)`);

  console.log();
  console.log(
    "[bench] Numbers above are the deterministic safety engine (runs on any CPU, every triage).\n" +
      "[bench] Model TTFT (MedGemma-4B), Whisper STT and Supertonic TTS require the @qvac/sdk\n" +
      "[bench] native runtime and are DEVICE-ONLY — measure on a dev build, not in Node/CI."
  );

  const results = {
    timestamp: new Date().toISOString(),
    measured_cpu: {
      interaction_check: interaction,
      red_flag_scan: redFlag,
      combined_safety_pass: safety,
    },
    device_only_note:
      "MedGemma-4B TTFT, Whisper STT and Supertonic TTS require the @qvac/sdk native runtime; measure on a dev build (npx expo run:ios/android).",
  };

  const outFile = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data", "bench_results.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n[bench] Results written: ${outFile}`);

  if (assertMode) {
    // Conservative budgets for the deterministic engine (must hold on any CPU).
    const ok = interaction.p95_ms < 50 && redFlag.p95_ms < 50 && safety.p95_ms < 100;
    console.log(`\n[bench] Assert budgets: ${ok ? "✅ PASS" : "❌ FAIL"}`);
    process.exit(ok ? 0 : 1);
  }
}

main().catch((err) => {
  console.error("[bench] failed:", err);
  process.exit(1);
});
