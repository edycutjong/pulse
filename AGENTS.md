# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# 🫀 Pulse — Agent Instructions

## Project
Offline MedPsy voice health companion. Voice symptom intake → local RAG over medical corpus → MedPsy reasoning → cited triage with drug-interaction warnings → spoken response. Everything on-device, zero cloud.

## Hackathon
**QVAC Hackathon I – Unleash Edge AI** (DoraHacks) — Psy Models Track (MedPsy) + Build in Public. $21,000 USDT pool.

## Structure
- `src/core/qvac.ts` — Shared QVAC SDK wrapper (loadModel, completion, RAG, TTS, P2P)
- `src/core/rag.ts` — Medical RAG pipeline (embedding model lifecycle, ingest, search)
- `src/core/triage.ts` — Conservative triage engine (MedPsy prompt, drug interaction checks, structured JSON output)
- `src/core/redFlags.ts` — Red-flag escalation engine (40-pattern deterministic symptom scanner)
- `src/core/voice.ts` — Voice pipeline (Whisper STT → process → Supertonic TTS)
- `data/fixtures/` — interactions.csv, red_flags.csv
- `data/corpus/` — Bundled medical corpus (WHO, first-aid)
- `scripts/` — seed.py, bench.py, verify_offline.py, check_submission_readiness.py
- `App.tsx` — Expo entry point (React Native)

## Tech Stack
| Layer | Technology |
|---|---|
| **Mobile App** | Expo 56, React Native 0.85, React 19 |
| **AI Engine** | @qvac/sdk (completion w/ MedGemma-4B, RAG, TTS, STT) |
| **Medical RAG** | GTE-Large-FP16 embeddings + ragSearch |
| **Voice** | Whisper (STT) + Supertonic (TTS) via @qvac/sdk |

## Key Rules
- **All inference** must go through `@qvac/sdk` — zero cloud APIs
- **Medical model**: `COMPLETION_MODEL_ID = MEDGEMMA_4B_IT_Q4_1` (QVAC's specialized medical model) for completion; `LLAMA_MODEL_ID` is the lighter fallback for ≤4GB nodes
- **Conservative triage**: if ANY doubt, default to more urgent level
- **Citations**: every factual claim must cite its source chunk (≥95% coverage)
- **Drug interactions**: deterministic CSV-based check PLUS LLM-based check
- **Fallback**: if LLM JSON parse fails, use keyword-based conservative fallback
- **Colors**: Red (#ef4444) for emergency, Amber (#f59e0b) for urgent, Green (#22c55e) for routine, Cyan (#06b6d4) for citations
- **Test target**: 100+ tests stated in README
- **NOT a medical device** — always state this in submission

## Critical Patterns
- Triage levels: `"emergency"` | `"urgent"` | `"routine"` — never output `"you're fine"` for red-flag symptoms
- `checkDrugInteractions()` runs deterministically from `data/fixtures/interactions.csv`
- `checkRedFlags()` scans 40 clinical patterns from `data/fixtures/red_flags.csv` and auto-escalates triage level
- Voice pipeline: `transcribeAudio → processText callback → synthesizeSpeech`
- Embedding model lifecycle: `initEmbeddingModel()` is lazy-loaded singleton
- `searchMedicalKnowledge()` falls back to hardcoded seed data if corpus not initialized
