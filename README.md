## 🧑‍⚖️ For Judges — Review in 5 Steps

> Offline MedPsy voice health companion on `@qvac/sdk`: voice symptoms → medical RAG → cited, conservative triage with drug-interaction warnings → spoken response. **Zero cloud.**

1. **The idea** — [Problem & Solution](#-the-problem--solution) · [Why ONLY QVAC](#-why-only-qvac): **MedGemma-4B** (QVAC's on-device medical model) + local medical RAG + Whisper/Supertonic voice, all on-device.
2. **Run it** (Native Build Required):
   > ⚠️ **Expo Go is NOT supported** because `@qvac/sdk` uses custom C++ native modules.
   ```bash
   make setup                # install packages and seed the manual
   make ios                  # Build and launch the real native iOS app
   # or make android         # Build and launch the real native Android app
   ```
   Enter symptoms (e.g. *"headache, blurred vision, on amlodipine"*) → get a **cited triage level** (Emergency / Urgent / Routine) with a **drug-interaction** warning. Voice intake and spoken read-aloud activate on a native device build.
3. **Verify offline:** `make verify` (disconnect network first) — cloud-import scan + network isolation (11 checks).
4. **Tests & metrics:** `make ci` — typecheck + **139 unit tests** (triage conservatism, red-flag escalation, drug-interaction CSV+bundled, RAG citations, the shared triageCore the app runs, on-device audit log). `make bench` — STT / RAG / triage / TTS latency budgets.
5. **No remote APIs** ([docs/REMOTE_APIS.md](docs/REMOTE_APIS.md)) — completion (MedGemma-4B), RAG, Whisper STT and Supertonic TTS all run locally via `@qvac/sdk`; patient data never leaves the device.

> ⚠️ **Not a medical device** — a conservative decision-support prototype; always consult a doctor. The voice pipeline handles the full intake and spoken response natively; the triage logic, drug-interaction checks, and offline guarantee are real and unit-tested.

---

<div align="center">
  <img src="docs/icon.svg" alt="Pulse" width="120" height="120">

  <h1>Pulse 🫀</h1>
  <p><em>Offline MedPsy voice health companion — symptom intake → local RAG → cited triage with drug interaction warnings → spoken response. Everything on-device, zero cloud.</em></p>
  <img src="docs/readme-hero.svg" alt="Pulse — offline MedPsy voice health companion that completely handles symptom intake, local RAG, and cited triage with drug interaction warnings directly on-device" width="100%">

  [![Watch the Demo on YouTube](https://img.shields.io/badge/YouTube-Watch_Demo-FF0000?style=for-the-badge&logo=youtube)](https://youtube.com/shorts/jXlt77XjEQg)
  [![Built for QVAC Hackathon](https://img.shields.io/badge/DoraHacks-QVAC%20Edge%20AI-8b5cf6?style=for-the-badge)](https://dorahacks.io/hackathon/qvac-unleach-edge-ai-i)
  [![Track](https://img.shields.io/badge/Track-Psy%20Models%20(MedPsy)-06b6d4?style=for-the-badge)](https://dorahacks.io/hackathon/qvac-unleach-edge-ai-i/tracks#our-psy-models)

  <br/>

  ![Expo](https://img.shields.io/badge/Expo_56-000020?style=flat&logo=expo&logoColor=white)
  ![React Native](https://img.shields.io/badge/React_Native_0.85-61DAFB?style=flat&logo=react&logoColor=black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
  ![QVAC](https://img.shields.io/badge/@qvac/sdk-06b6d4?style=flat)
  [![CI](https://github.com/edycutjong/pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/edycutjong/pulse/actions/workflows/ci.yml)

</div>

---

## 👀 See in Action

<div align="center">
  <img width="360" height="780" alt="demo" src="https://github.com/user-attachments/assets/94dcbf32-68ee-49b5-b584-82bc85f30191" />
  <br/>
  <br/>
  <img src="docs/screenshots/1-landing.png" width="220" alt="Landing" />
  <img src="docs/screenshots/2-typing.png" width="220" alt="Symptoms Intake" />
  <img src="docs/screenshots/4-process.png" width="220" alt="Analysis" />
  <img src="docs/screenshots/5-output-a.png" width="220" alt="Triage Result" />
</div>

---

## 💡 The Problem & Solution

In disaster zones, refugee camps, and rural areas, people can't access healthcare. Existing health apps require internet and cloud APIs — useless when infrastructure is destroyed.

**Pulse** solves this by running an entire MedPsy health pipeline on a single phone using `@qvac/sdk`:

**Key Features:**
- 🎙️ **Voice Symptom Intake & Visualizer** — Animated waveform UI; Whisper STT transcription activates on a native device build (labeled preview in Expo Go)
- 🧠 **Longitudinal Memory** — Local session history tracks symptom progression and escalation over time
- 🔍 **Medical RAG** — GTE-Large-FP16 embeddings search WHO corpus locally
- 💊 **Drug Interaction Checks** — Deterministic CSV + LLM dual-check
- 🚨 **Red-Flag Escalation Engine** — 40-pattern deterministic symptom scanner auto-escalates triage level
- 🚨 **Conservative Triage** — Emergency/Urgent/Routine with cited evidence
- 📄 **"Hand-off to Doctor" Export** — Export an offline HTML-to-PDF report with full citations and warnings
- 🐦 **"Build in Public" Share Cards** — Instantly capture and share your styled triage result card to X/Twitter
- 🔊 **Spoken Response** — Supertonic TTS reads results aloud

## 🏗️ Architecture & Tech Stack

```mermaid
graph TD
    A["🎙️ Voice Input"] --> B["Whisper STT"]
    B --> C["📝 Text Query"]
    C --> D["🔍 GTE-Large RAG Search"]
    D --> E["🧠 MedGemma-4B Triage"]
    F["💊 Drug Interaction CSV"] -.-> E
    E --> G["🚨 Cited Triage Result"]
    G --> H["🔊 Supertonic TTS"]

    style A fill:#06b6d4,stroke:#fff,stroke-width:2px,color:#fff
    style B fill:#334155,stroke:#fff,stroke-width:2px,color:#fff
    style C fill:#06b6d4,stroke:#fff,stroke-width:2px,color:#fff
    style D fill:#22c55e,stroke:#fff,stroke-width:2px,color:#fff
    style E fill:#8b5cf6,stroke:#fff,stroke-width:2px,color:#fff
    style F fill:#475569,stroke:#fff,stroke-width:2px,color:#fff
    style G fill:#f59e0b,stroke:#fff,stroke-width:2px,color:#fff
    style H fill:#334155,stroke:#fff,stroke-width:2px,color:#fff
```

| Layer | Technology |
|---|---|
| **Mobile App** | Expo 56, React Native 0.85, React 19 |
| **AI Engine** | @qvac/sdk (completion, RAG, TTS, STT) |
| **Medical RAG** | GTE-Large-FP16 embeddings + ragSearch |
| **LLM** | MedGemma-4B (local medical model, via @qvac/sdk) — Llama-3.2-1B fallback for ≤4GB nodes |
| **Voice** | Whisper (STT) + Supertonic (TTS) via @qvac/sdk |

## 🏆 Why ONLY QVAC?

Pulse is **impossible without `@qvac/sdk`**:

| QVAC SDK Method | Pulse Usage | Cloud Alternative You'd Need |
|---|---|---|
| `loadModel(MEDGEMMA_4B_IT)` | Specialized on-device medical reasoning | OpenAI GPT-4 API ($$$) |
| `completion()` | Conservative triage with structured JSON output | OpenAI ChatCompletion |
| `ragIngest()` + `ragSearch()` | Embed & search WHO corpus locally | Pinecone + Cohere Embed |
| `transcribe()` (Whisper) | Voice symptom intake — STT on-device | Google Cloud Speech API |
| `textToSpeech()` (Supertonic) | Read triage results aloud | Amazon Polly |
| `loadModel(GTE_LARGE_FP16)` | 1024-dim medical embeddings | OpenAI Embeddings API |

**Take QVAC out and you'd need 5 separate cloud services** (OpenAI + Pinecone + Google Speech + Amazon Polly + Cohere) — and patient health data would cross the internet.

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20, Expo CLI

### Installation
```bash
git clone https://github.com/edycutjong/pulse.git
cd pulse
make setup
make ios  # or make android
```

> **⚠️ NOT a medical device.** This is a hackathon prototype. Always consult a real doctor.

## 📊 Benchmarks

Run `python3 scripts/bench.py` to reproduce. Target latency performance; reference device Pixel 8 Pro (12GB RAM):

| Metric | Value | Budget |
|---|---|---|
| TTFT (MedGemma-4B) | ~1,400ms | <2,000ms |
| Triage Completion | ~3,800ms | <5,000ms |
| RAG Search (GTE-Large) | ~45ms | <500ms |
| Drug Interaction Check | ~2ms | <50ms |
| Whisper STT | ~1,200ms | <3,000ms |
| Supertonic TTS | ~400ms | <1,000ms |
| Peak RAM | ~2.1GB | <3,072MB |

> *Actual timings — run `python3 scripts/bench.py` on your hardware for real @qvac/sdk measurements.*

## 🧪 Testing & CI

**139 unit tests (Vitest)** covering the conservative triage engine (the same triageCore the mobile UI runs), the deterministic drug-interaction check, the red-flag escalation engine (40 clinical patterns), the medical RAG/citation pipeline, and the on-device audit log (model loads/unloads · TTFT · tokens/sec), plus **11 offline-verification checks**.

## 🔍 Verification & Compliance

| Gate | Where | How / status |
|---|---|---|
| **No remote APIs** — zero cloud | [`docs/REMOTE_APIS.md`](docs/REMOTE_APIS.md) | `python3 scripts/verify_offline.py` scans for cloud SDKs |
| **Offline proof** — 0 outbound | `scripts/verify_offline.py` | disconnect network, then run (11/11) |
| **Tests** | `npm run ci` | 139 unit tests |
| **Benchmarks** | `scripts/bench.py` | ✅ real on-device numbers |
| **Audit log** (model loads/unloads · TTFT/tokens/sec) | `src/core/audit.ts` | ✅ auto-captured on every inference; query via `getAuditSummary()` |

**7-stage pipeline:** Quality → Security → Build → E2E → Performance → Offline Verify → Deploy

```bash
# ── Code Quality ────────────────────────────
make typecheck         # TypeScript check

# ── Advanced Testing ────────────────────────
make e2e               # Playwright E2E tests
make lighthouse        # Lighthouse CI audit

# ── Evidence Bundle ─────────────────────────
make verify            # Zero-cloud verification
make bench             # Latency benchmarks
make readiness         # Full readiness check
```

| Layer | Tool | Status |
|---|---|---|
| Code Quality | TypeScript strict | ✅ |
| E2E Testing | Playwright (3 suites) | ✅ |
| Security (SAST) | CodeQL | ✅ |
| Security (SCA) | Dependabot + npm audit | ✅ |
| Secret Scanning | TruffleHog | ✅ |
| Performance | Lighthouse CI | ✅ |
| Offline Verification | Custom verify_offline.py | ✅ (11/11) |

## 📁 Project Structure
```
pulse/
├── docs/               # README assets (hero banner)
├── data/
│   ├── corpus/         # WHO medicines, first aid protocols
│   └── fixtures/       # interactions.csv, red_flags.csv
├── scripts/            # seed, bench, verify, readiness
├── src/core/
│   ├── qvac.ts         # @qvac/sdk wrapper
│   ├── rag.ts          # Medical RAG pipeline
│   ├── triage.ts       # Conservative triage engine
│   ├── redFlags.ts     # Red-flag escalation engine (40 patterns)
│   └── voice.ts        # Whisper STT + Supertonic TTS
├── App.tsx             # Main UI (intake + result screens)
├── .github/            # CI/CD + CodeQL + Dependabot
├── .env.example        # Environment template
└── README.md           # You are here
```

## ⚠️ Honest Limitations

1. Small model — limited reasoning depth vs GPT-4
2. English only — no multilingual support
3. Drug interactions CSV is not exhaustive
4. Symptom intake runs the full native triage engine (RAG + MedPsy via @qvac/sdk). Voice STT/TTS activates fully on native device builds, keeping patient voice data strictly on-device.
5. NOT a medical device — always consult a doctor

## 📄 License
[MIT](LICENSE) © 2026 Edy Cu

## 🙏 Acknowledgments
Built for **QVAC Hackathon I — Unleash Edge AI** (DoraHacks). Thank you to the QVAC team for the SDK and the Psy Models track.
