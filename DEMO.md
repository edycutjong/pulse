# Pulse — Demo Script

## Setup (Before Demo)

1. Install dependencies: `npm install`
2. Seed corpus: `python3 scripts/seed.py`
3. Start app: `npx expo start --ios` (or `--android`)
4. **Enable Airplane Mode** on the device

## Demo Flow (2 minutes)

### Scene 1: Show Offline Status (15s)
- Point camera at the **airplane mode toggle** — ON
- Show the green "OFFLINE · QVAC" pill in the app header
- Narration: "Pulse runs entirely offline. No cloud, no internet. Everything stays on your phone."

### Scene 2: Voice Symptom Intake (20s)
- Tap the 🎙️ mic button
- Speak: "I have a severe headache and blurred vision, and I take warfarin"
- Show the text appearing in the symptom field
- Narration: "Whisper STT transcribes locally. Zero data leaves the device."

### Scene 3: Triage Result (30s)
- Tap "Analyze Symptoms"
- Show the loading animation (MedPsy inference)
- Result appears: **🟡 URGENT** badge
- Show the assessment text
- Narration: "MedPsy-1.7B runs triage using local RAG over WHO protocols. Conservative — when in doubt, escalate."

### Scene 4: Drug Interaction Warning (20s)
- Scroll to the **⚠️ Drug Interaction Warnings** section
- Show: "Warfarin + Ibuprofen: Increased risk of bleeding"
- Narration: "Deterministic CSV-based drug interaction checks catch dangerous combinations instantly."

### Scene 5: Citations (15s)
- Tap "Show Citations"
- Show the source attribution cards
- Narration: "Every claim is cited. You can trace exactly which protocol drove the assessment."

### Scene 6: Routine Query (20s)
- Go back, enter: "I have a mild headache, no other symptoms"
- Show result: **🟢 ROUTINE**
- Narration: "Not everything is an emergency. Pulse triages proportionally."

### Closing (10s)
- Show airplane mode still ON
- Narration: "Your health data never left your phone. That's Pulse — offline MedPsy, powered by QVAC."

## Devastating Demo Query

Use this for maximum impact:

> "I'm taking warfarin for my heart condition and I just took ibuprofen for a headache. Now I have chest pain radiating to my left arm."

Expected result:
- **🔴 EMERGENCY** — chest pain pattern match
- **⚠️ Drug Warning** — warfarin + ibuprofen bleeding risk
- **3 recommendations** including "Call 911 immediately"
- **2 citations** from WHO protocols
