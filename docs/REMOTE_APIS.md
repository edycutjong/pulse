# Remote APIs

**Pulse makes zero remote/cloud API calls. The entire health pipeline runs on-device via `@qvac/sdk`.**

Voice intake, medical reasoning, retrieval, and speech output all run locally. There is no cloud LLM, no hosted vector DB, and no external speech service — the most sensitive data class (personal health) never leaves the phone.

## APIs / external interfaces used

| Interface | Type | When | Data sent over the internet |
|---|---|---|---|
| `@qvac/sdk` — `completion` (MedPsy-1.7B) | **Local, on-device** | Triage reasoning | **None** |
| `@qvac/sdk` — `ragIngest` / `ragSearch` (GTE-Large-FP16) | **Local, on-device** | Medical corpus retrieval + citations | **None** |
| `@qvac/sdk` — `transcribe` (Whisper STT) | **Local, on-device** | Voice symptom intake | **None** |
| `@qvac/sdk` — `textToSpeech` (Piper TTS) | **Local, on-device** | Spoken response | **None** |
| Drug-interaction table (`data/fixtures/interactions.csv`) | **Local file** | Deterministic interaction check | **None** |
| QVAC model registry / HuggingFace | Network **download only** | First run only | None — fetches open model weights once, then offline |

No analytics, telemetry, or third-party services. After the one-time model download, Pulse runs fully air-gapped — the in-app network monitor shows 0 outbound connections.

## How this is enforced (verifiable)

`scripts/verify_offline.py` is part of the evidence bundle and CI:

1. **Cloud-import scan** — fails if the source imports any banned cloud SDK (`openai`, `anthropic`, `googleapis`, `azure`, `aws-sdk`, `pinecone`, `cohere`, `firebase`, `supabase`) — i.e. no OpenAI, no Google Cloud Speech, no Amazon Polly, no Pinecone/Cohere.
2. **SDK-only check** — confirms reasoning/RAG/STT/TTS go through `@qvac/sdk`.
3. **Network isolation** — run with the network disconnected; asserts no outbound connectivity (11 checks).

```bash
# disconnect the network first, then:
python3 scripts/verify_offline.py     # → 11/11 checks
```
