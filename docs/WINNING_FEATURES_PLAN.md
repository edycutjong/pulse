# 🏆 Pulse: Winning Features Execution Plan

This document outlines the architectural plan and steps to implement the four high-impact features designed to maximize the winnability of the Pulse project for the DoraHacks QVAC Edge AI Hackathon.

## 1. Longitudinal Memory (Session History)
**Goal:** Give the MedPsy model context of previous triage sessions to detect symptom escalation over time.
* **Storage Layer:** We will install `@react-native-async-storage/async-storage` to persist past triage records locally.
* **Core Update (`src/core/triage.ts`):** 
  * Modify the `triageCore` function to accept an optional `patientHistory` array.
  * Update the MedPsy prompt to inject this history (e.g., *"Patient History: 2 days ago reported mild headache."*) before the current symptoms, instructing the model to look for escalation.
* **UI Update (`App.tsx`):**
  * Load history on app start.
  * After a successful triage, append the result to the local history.
  * Add a "Clear History" debug button.

## 2. "Hand-off to Doctor" Export (PDF)
**Goal:** Allow users to export a cited, offline medical report to share with professionals.
* **Libraries:** We will install `expo-print` (for HTML-to-PDF generation) and `expo-sharing` (to invoke the native share sheet).
* **Implementation:**
  * Create a utility function `generateDoctorReport(triageResult)` that compiles an HTML template featuring the Pulse branding, the triage level, drug interactions, and the raw citations from the WHO corpus.
  * **UI Update (`App.tsx`):** Add a sleek "Export for Doctor" button on the results screen. Clicking it generates the PDF and opens the iOS/Android share sheet.

## 3. Real-time Audio Visualizer
**Goal:** Elevate the voice-intake UX to feel like a premium, state-of-the-art voice assistant (like Siri or Apple Intelligence).
* **Implementation:** 
  * Since we are using standard Expo and React Native, we will use the `Animated` API from React Native.
  * Create a new component `<VoiceVisualizer isRecording={boolean} />`.
  * When `isRecording` is true, the visualizer will animate multiple overlapping, semi-transparent cyan/green circles (`#06b6d4` and `#22c55e`) that scale up and down using sine waves and random delays to simulate audio waveforms.
  * **UI Update (`App.tsx`):** Replace the static "Recording..." text with this animated component.

## 4. "Build in Public" Share Cards
**Goal:** Effortlessly generate stunning social media cards displaying the on-device AI performance metrics.
* **Libraries:** We will install `react-native-view-shot` to capture React Native views as images, and reuse `expo-sharing`.
* **Implementation:**
  * Create a visually striking, hidden (or modal) component `<PerformanceCard metrics={auditStats} />` styled with our neon dark-mode aesthetic.
  * **UI Update (`App.tsx`):** Add a "Share Stats to X/Twitter" button. When pressed, it takes the latest `getAuditSummary()` metrics, renders the card, uses `ViewShot` to capture it to a `.png`, and opens the native share sheet.

---

### Execution Steps
1. **Dependencies:** Run `npx expo install @react-native-async-storage/async-storage expo-print expo-sharing react-native-view-shot`.
2. **Core Logic:** Update `src/core/triage.ts` for history.
3. **UI Components:** Build `<VoiceVisualizer />` and `<PerformanceCard />`.
4. **Integration:** Wire up `App.tsx` state to handle history, PDF export, and ViewShot sharing.
5. **Testing:** Run existing test suites (`npm run ci`) to ensure we haven't broken the offline/triage guarantees, and add new tests for the history prompt builder.
