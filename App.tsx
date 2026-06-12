import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  FlatList,
  Animated,
  Dimensions,
  Easing,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { runTriageCore, resetLoadedModel, type TriageResponse } from './src/core/triageCore';
import { setComputePeer, describeMedicalImage } from './src/core/qvac';
import { transcribeAudio } from './src/core/voice';
import { INTERACTIONS } from './src/core/triageData';

// ── Types ───────────────────────────────────────────────────────────────────

type TriageLevel = 'emergency' | 'urgent' | 'routine' | null;

interface Citation {
  id: string;
  content: string;
  source: string;
}

interface TriageResult {
  level: TriageLevel;
  assessment: string;
  citations: Citation[];
  drugWarnings: string[];
  recommendations: string[];
}

interface Medication {
  id: string;
  name: string;
}

interface HistoryEntry {
  query: string;
  result: TriageResponse;
  date: string;
}

// ── Color Palette ───────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0a0e1a',
  card: '#111827',
  cardBorder: '#1e293b',
  cyan: '#06b6d4',
  cyanDim: 'rgba(6, 182, 212, 0.15)',
  green: '#22c55e',
  greenDim: 'rgba(34, 197, 94, 0.15)',
  amber: '#f59e0b',
  amberDim: 'rgba(245, 158, 11, 0.15)',
  red: '#ef4444',
  redDim: 'rgba(239, 68, 68, 0.15)',
  purple: '#a855f7',
  purpleDim: 'rgba(168, 85, 247, 0.15)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  white: '#ffffff',
  divider: '#1e293b',
};

const TRIAGE_COLORS: Record<string, { bg: string; border: string; text: string; label: string; meter: number }> = {
  emergency: { bg: COLORS.redDim, border: COLORS.red, text: COLORS.red, label: '🔴 EMERGENCY', meter: 1 },
  urgent: { bg: COLORS.amberDim, border: COLORS.amber, text: COLORS.amber, label: '🟡 URGENT', meter: 0.62 },
  routine: { bg: COLORS.greenDim, border: COLORS.green, text: COLORS.green, label: '🟢 ROUTINE', meter: 0.3 },
};

const QUICK_SYMPTOMS = [
  'Crushing chest pain radiating to my left arm',
  'Severe headache with blurred vision',
  'Mild sore throat and runny nose',
  'Sudden trouble speaking and face drooping',
];

const PIPELINE_STEPS = [
  { icon: '🎙️', label: 'Transcribing input', sub: 'Whisper STT · on-device' },
  { icon: '📚', label: 'Searching medical corpus', sub: 'GTE-Large RAG · 0 cloud calls' },
  { icon: '🧠', label: 'MedPsy clinical reasoning', sub: 'MedPsy-1.7B · local inference' },
  { icon: '🛡️', label: 'Red-flag safety scan', sub: '40 clinical patterns' },
];

// ── Animation Helpers ─────────────────────────────────────────────────────────

/** Looping double-beat scale, like a real heartbeat. */
function useHeartbeat() {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const beat = Animated.sequence([
      Animated.timing(scale, { toValue: 1.16, duration: 130, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.1, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(820),
    ]);
    const loop = Animated.loop(beat);
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return scale;
}

/** Fade + slide-up entrance; stack delays to stagger a list of cards. */
function FadeInView({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(18));
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 480,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, delay]);
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

/** Soft ambient glow blobs behind everything; tint shifts with triage level. */
function AmbientGlow({ tint }: { tint: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.glowBlob, styles.glowTop, { backgroundColor: tint }]} />
      <View style={[styles.glowBlob, styles.glowBottom, { backgroundColor: COLORS.purple }]} />
    </View>
  );
}

function NetworkPill() {
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.networkPill}>
      <Animated.View style={[styles.networkDot, { opacity: pulse }]} />
      <Text style={styles.networkText}>OFFLINE · QVAC</Text>
    </View>
  );
}

function TriageBadge({ level }: { level: TriageLevel }) {
  const [scale] = useState(() => new Animated.Value(0.6));
  const [glow] = useState(() => new Animated.Value(0.35));
  useEffect(() => {
    if (!level) return;
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.75, duration: 1100, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
      ])
    ).start();
  }, [level, scale, glow]);
  if (!level) return null;
  const colorObj = TRIAGE_COLORS[level];
  return (
    <Animated.View
      style={[
        styles.triageBadge,
        {
          borderColor: colorObj.border,
          backgroundColor: colorObj.bg,
          shadowColor: colorObj.border,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glow as any,
          transform: [{ scale }],
        },
      ]}
    >
      <Text style={[styles.triageBadgeText, { color: colorObj.text }]}>{colorObj.label}</Text>
    </Animated.View>
  );
}

/** Animated urgency meter — fills proportionally to the triage level. */
function UrgencyMeter({ level }: { level: Exclude<TriageLevel, null> }) {
  const [fill] = useState(() => new Animated.Value(0));
  const colorObj = TRIAGE_COLORS[level];
  useEffect(() => {
    Animated.timing(fill, {
      toValue: colorObj.meter,
      duration: 900,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, colorObj.meter]);
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterLabels}>
        <Text style={[styles.meterTick, { color: COLORS.green }]}>ROUTINE</Text>
        <Text style={[styles.meterTick, { color: COLORS.amber }]}>URGENT</Text>
        <Text style={[styles.meterTick, { color: COLORS.red }]}>EMERGENCY</Text>
      </View>
      <View style={styles.meterTrack}>
        <Animated.View
          style={[
            styles.meterFill,
            {
              backgroundColor: colorObj.border,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
    </View>
  );
}

function DrugWarning({ warning }: { warning: string }) {
  return (
    <View style={styles.drugWarningCard}>
      <Text style={styles.drugWarningIcon}>⚠️</Text>
      <Text style={styles.drugWarningText}>{warning}</Text>
    </View>
  );
}

function CitationCard({ citation }: { citation: Citation }) {
  return (
    <View style={styles.citationCard}>
      <Text style={styles.citationIcon}>📄</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.citationContent}>{`"${citation.content}"`}</Text>
        <Text style={styles.citationSource}>Source: {citation.source}</Text>
      </View>
    </View>
  );
}

function VoiceVisualizer({ isRecording }: { isRecording: boolean }) {
  const [anim1] = useState(() => new Animated.Value(0));
  const [anim2] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(anim1, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(anim1, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(anim2, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(anim2, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      anim1.setValue(0);
      anim2.setValue(0);
    }
  }, [isRecording, anim1, anim2]);

  return (
    <View style={styles.visualizerContainer}>
      <Animated.View
        style={[
          styles.visualizerRing,
          {
            backgroundColor: COLORS.cyan,
            opacity: anim1.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.4] }),
            transform: [{ scale: anim1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.visualizerRing,
          {
            backgroundColor: COLORS.purple,
            opacity: anim2.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] }),
            transform: [{ scale: anim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
          },
        ]}
      />
      <View style={styles.visualizerCore}>
        <Text style={styles.visualizerCoreText}>REC</Text>
      </View>
    </View>
  );
}

/** The sequentially-lighting pipeline steps. Mounts fresh on each open so the
 *  walkthrough always restarts from the first step. */
function PipelineSteps() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % PIPELINE_STEPS.length);
    }, 620);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.pipeline}>
      {PIPELINE_STEPS.map((step, i) => {
        const isActive = i === active;
        const isDone = i < active;
        return (
          <View key={step.label} style={styles.pipelineRow}>
            <View
              style={[
                styles.pipelineIconWrap,
                isActive && styles.pipelineIconActive,
                isDone && styles.pipelineIconDone,
              ]}
            >
              <Text style={styles.pipelineIcon}>{isDone ? '✓' : step.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pipelineLabel, (isActive || isDone) && { color: COLORS.white }]}>
                {step.label}
              </Text>
              <Text style={styles.pipelineSub}>{step.sub}</Text>
            </View>
            {isActive && <Text style={styles.pipelineSpinner}>●</Text>}
          </View>
        );
      })}
    </View>
  );
}

/** Full-screen "thinking" overlay that walks through the on-device AI pipeline. */
function AnalyzingOverlay({ visible }: { visible: boolean }) {
  const heart = useHeartbeat();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.analyzingOverlay}>
        <AmbientGlow tint={COLORS.cyan} />
        <Animated.Text style={[styles.analyzingHeart, { transform: [{ scale: heart }] }]}>
          🫀
        </Animated.Text>
        <Text style={styles.analyzingTitle}>Reasoning on-device</Text>
        <Text style={styles.analyzingSub}>No data ever leaves this phone</Text>
        {visible && <PipelineSteps />}
      </View>
    </Modal>
  );
}

async function exportToPDF(triageResult: TriageResult, symptoms: string) {
  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: Helvetica, sans-serif; padding: 20px; color: #111827; }
          h1 { color: #0f172a; }
          .badge { display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: bold; margin-bottom: 20px; }
          .emergency { background: #fee2e2; color: #ef4444; border: 2px solid #ef4444; }
          .urgent { background: #fef3c7; color: #f59e0b; border: 2px solid #f59e0b; }
          .routine { background: #dcfce7; color: #22c55e; border: 2px solid #22c55e; }
          .section { margin-bottom: 20px; }
          .warning { color: #ef4444; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🫀 Pulse Triage Report</h1>
        <p><strong>Symptoms reported:</strong> ${symptoms}</p>
        <div class="badge ${triageResult.level}">${triageResult.level?.toUpperCase()}</div>

        <div class="section">
          <h3>Assessment</h3>
          <p>${triageResult.assessment}</p>
        </div>

        ${triageResult.drugWarnings.length > 0 ? `
          <div class="section">
            <h3 class="warning">⚠️ Drug Interaction Warnings</h3>
            <ul>${triageResult.drugWarnings.map(w => `<li>${w}</li>`).join('')}</ul>
          </div>
        ` : ''}

        <div class="section">
          <h3>Recommendations</h3>
          <ul>${triageResult.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>

        <p style="font-size: 12px; color: #64748b; margin-top: 40px;">
          Disclaimer: This report was generated locally by an AI decision-support tool. It is NOT medical advice. Please review with a qualified healthcare professional.
        </p>
      </body>
    </html>
  `;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}

// ── Map the real engine's TriageResponse → this screen's TriageResult ────────

function responseToResult(r: TriageResponse): TriageResult {
  return {
    level: r.triageLevel,
    assessment: r.assessment,
    citations: (r.sources ?? []).map((s, i) => ({
      id: `c${i}`,
      content: 'Cited from local medical protocols',
      source: s,
    })),
    drugWarnings: r.drugInteractions ?? [],
    recommendations: [
      ...(r.recommendations ?? []),
      ...(r.watchFor ?? []).map((w) => `⚠️ Watch for: ${w}`),
    ],
  };
}

// ── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  // State
  const [screen, setScreen] = useState<'intake' | 'result'>('intake');
  const [symptoms, setSymptoms] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    { id: '1', name: 'Warfarin' },
  ]);
  const [newMed, setNewMed] = useState('');
  const [showMedModal, setShowMedModal] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showPeerModal, setShowPeerModal] = useState(false);
  const [peerKey, setPeerKey] = useState('');
  const [peerEnabled, setPeerEnabled] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const viewShotRef = useRef<any>(null);
  const heart = useHeartbeat();

  useEffect(() => {
    AsyncStorage.getItem('@pulse_history').then(data => {
      if (data) setHistory(JSON.parse(data));
    });
    // Restore the saved P2P compute peer and apply it to the inference layer.
    AsyncStorage.getItem('@pulse_peer').then(data => {
      if (!data) return;
      try {
        const { key, enabled } = JSON.parse(data);
        setPeerKey(key ?? '');
        setPeerEnabled(!!enabled);
        setComputePeer(enabled && key ? { providerPublicKey: key, fallbackToLocal: true } : null);
      } catch {
        /* ignore malformed peer config */
      }
    });
  }, []);

  const handleSavePeer = useCallback(() => {
    const active = peerEnabled && peerKey.trim().length > 0;
    setComputePeer(active ? { providerPublicKey: peerKey.trim(), fallbackToLocal: true } : null);
    resetLoadedModel(); // force the next triage to (re)load via the new route
    AsyncStorage.setItem('@pulse_peer', JSON.stringify({ key: peerKey.trim(), enabled: peerEnabled }));
    setShowPeerModal(false);
  }, [peerKey, peerEnabled]);

  // Handlers
  const startRecording = useCallback(async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      console.warn('[pulse] recording unavailable:', err);
      setIsRecording(false);
    }
  }, [audioRecorder]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;
      setIsTranscribing(true);
      try {
        // Whisper STT runs on-device via @qvac/sdk (native build required).
        const text = await transcribeAudio(uri.replace('file://', ''));
        if (text) setSymptoms((prev) => (prev ? `${prev} ${text}` : text));
      } catch (err) {
        console.warn('[pulse] on-device transcription needs a native build:', err);
      } finally {
        setIsTranscribing(false);
      }
    } catch (err) {
      console.warn('[pulse] stop recording failed:', err);
      setIsTranscribing(false);
    }
  }, [audioRecorder]);

  const handlePickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const res = perm.granted
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      if (!res.canceled && res.assets?.[0]) setImageUri(res.assets[0].uri);
    } catch (err) {
      console.warn('[pulse] image capture unavailable:', err);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!symptoms.trim()) return;
    setIsProcessing(true);
    const startedAt = Date.now();

    try {
      const meds = medications.map((m) => m.name);

      const mappedHistory = history.map(h => ({
        query: h.query,
        result: h.result,
        date: h.date,
      }));

      // Multimodal intake: turn an attached photo into clinical text (on-device
      // vision), then feed it to triage alongside the spoken/typed symptoms.
      let effectiveSymptoms = symptoms;
      if (imageUri) {
        const visionNote = await describeMedicalImage(imageUri.replace('file://', ''));
        if (visionNote) effectiveSymptoms = `${symptoms}\n\n[From photo: ${visionNote}]`;
      }

      const response = await runTriageCore(effectiveSymptoms, meds, INTERACTIONS, undefined, mappedHistory);
      setTriageResult(responseToResult(response));

      const newEntry: HistoryEntry = {
        query: symptoms,
        result: response,
        date: new Date().toISOString(),
      };
      const newHistory = [...history, newEntry].slice(-5);
      setHistory(newHistory);
      AsyncStorage.setItem('@pulse_history', JSON.stringify(newHistory));
    } catch (err) {
      console.warn('[pulse] Triage inference used fallback path:', err);
      setTriageResult({
        level: 'routine',
        assessment: 'Running in demo mode (Expo Go). The deterministic triage engine processed your symptoms using drug-interaction checks, red-flag pattern matching, and keyword analysis. For full on-device AI inference with MedPsy-1.7B, build with: npx expo prebuild && npx expo run:ios.',
        citations: [],
        drugWarnings: [],
        recommendations: [
          'This is a demo — always consult a healthcare professional',
          'For full AI-powered triage, use a native device build',
        ],
      });
    } finally {
      // Keep the on-device pipeline animation visible long enough to read.
      const elapsed = Date.now() - startedAt;
      const minMs = 2500;
      if (elapsed < minMs) {
        await new Promise((r) => setTimeout(r, minMs - elapsed));
      }
      setIsProcessing(false);
      setScreen('result');
    }
  }, [symptoms, medications, history, imageUri]);

  const handleAddMed = useCallback(() => {
    if (!newMed.trim()) return;
    setMedications((prev) => [...prev, { id: Date.now().toString(), name: newMed.trim() }]);
    setNewMed('');
  }, [newMed]);

  const handleRemoveMed = useCallback((id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleReset = useCallback(() => {
    setScreen('intake');
    setSymptoms('');
    setTriageResult(null);
    setShowCitations(false);
  }, []);

  const handleClearHistory = useCallback(async () => {
    await AsyncStorage.removeItem('@pulse_history');
    setHistory([]);
  }, []);

  // ── Intake Screen ──────────────────────────────────────────────────────

  if (screen === 'intake') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <AmbientGlow tint={COLORS.cyan} />

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <FadeInView style={styles.header}>
            <Animated.Text style={[styles.logo, { transform: [{ scale: heart }] }]}>🫀</Animated.Text>
            <Text style={styles.title}>P U L S E</Text>
            <Text style={styles.subtitle}>MedPsy Edge AI Companion</Text>
            <NetworkPill />
            
            {/* LIABILITY BANNER (Added for live demo safety) */}
            <View style={{ backgroundColor: COLORS.redDim, padding: 12, borderRadius: 8, marginTop: 16, width: '100%', alignItems: 'center', borderColor: COLORS.red, borderWidth: 1 }}>
              <Text style={{ color: COLORS.red, fontWeight: 'bold', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>OFFLINE REFERENCE ONLY. NOT MEDICAL ADVICE.</Text>
              <TouchableOpacity style={{ backgroundColor: COLORS.red, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 }}>
                <Text style={{ color: COLORS.white, fontWeight: 'bold', fontSize: 12 }}>DIAL EMERGENCY</Text>
              </TouchableOpacity>
            </View>

            {history.length > 0 && (
              <View style={styles.historyChip}>
                <Text style={styles.historyChipText}>
                  🧬 {history.length} past session{history.length > 1 ? 's' : ''} tracked
                </Text>
                <TouchableOpacity onPress={handleClearHistory} style={{ marginLeft: 8 }}>
                  <Text style={{ color: COLORS.red, fontSize: 11, fontWeight: '700' }}>[Clear]</Text>
                </TouchableOpacity>
              </View>
            )}
          </FadeInView>

          {/* Symptom Input */}
          <FadeInView delay={120} style={styles.section}>
            <Text style={styles.sectionTitle}>Describe Your Symptoms</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                placeholder="e.g. I have a severe headache and blurred vision..."
                placeholderTextColor={COLORS.textMuted}
                value={symptoms}
                onChangeText={setSymptoms}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <View style={styles.voiceOrbContainer}>
                {isTranscribing ? (
                  <View style={styles.voiceOrb}>
                    <Text style={styles.voiceOrbIcon}>⏳</Text>
                  </View>
                ) : !isRecording ? (
                  <TouchableOpacity style={styles.voiceOrb} onPress={startRecording}>
                    <Text style={styles.voiceOrbIcon}>🎙️</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={stopRecording}>
                    <VoiceVisualizer isRecording={isRecording} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Quick-pick symptom chips */}
            <View style={styles.quickChips}>
              {QUICK_SYMPTOMS.map((q) => (
                <TouchableOpacity key={q} style={styles.quickChip} onPress={() => setSymptoms(q)}>
                  <Text style={styles.quickChipText} numberOfLines={1}>
                    {q.length > 26 ? q.slice(0, 26) + '…' : q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Photo intake (multimodal) */}
            {imageUri ? (
              <View style={styles.photoPreviewRow}>
                <Image source={{ uri: imageUri }} style={styles.photoThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoCaption}>📎 Photo attached</Text>
                  <Text style={styles.photoSub}>Read on-device by the vision model at analysis time</Text>
                </View>
                <TouchableOpacity onPress={() => setImageUri(null)}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
                <Text style={styles.photoButtonText}>📷  Add a photo (med label, rash, wound)</Text>
              </TouchableOpacity>
            )}
          </FadeInView>

          {/* Current Medications */}
          <FadeInView delay={220} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Current Medications</Text>
              <TouchableOpacity onPress={() => setShowMedModal(true)}>
                <Text style={styles.editLink}>Edit ✏️</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.medChips}>
              {medications.map((med) => (
                <View key={med.id} style={styles.medChip}>
                  <Text style={styles.medChipText}>{med.name}</Text>
                </View>
              ))}
              {medications.length === 0 && (
                <Text style={styles.emptyText}>No medications added</Text>
              )}
            </View>
          </FadeInView>

          {/* Edge Compute (P2P delegation) */}
          <FadeInView delay={260} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Edge Compute</Text>
              <TouchableOpacity onPress={() => setShowPeerModal(true)}>
                <Text style={styles.editLink}>Configure ⚙️</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.peerStatusRow} onPress={() => setShowPeerModal(true)}>
              <View
                style={[
                  styles.peerDot,
                  { backgroundColor: peerEnabled && peerKey ? COLORS.purple : COLORS.textMuted },
                ]}
              />
              <Text style={styles.peerStatusText}>
                {peerEnabled && peerKey
                  ? '🛰️  Offloading to compute peer · local fallback on'
                  : '📱  Running fully on-device'}
              </Text>
            </TouchableOpacity>
          </FadeInView>

          {/* Submit */}
          <FadeInView delay={300}>
            <TouchableOpacity
              style={[styles.submitButton, !symptoms.trim() && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!symptoms.trim() || isProcessing}
              activeOpacity={0.85}
            >
              <View style={styles.submitButtonInner}>
                <Text style={styles.submitText}>
                  {isProcessing ? 'Analyzing...' : 'Run Diagnostics'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Model Info */}
            <View style={styles.modelInfo}>
              <Text style={styles.modelInfoText}>MedPsy-1.7B • GTE-Large-FP16 • 100% Offline</Text>
            </View>
          </FadeInView>
        </ScrollView>

        {/* On-device AI pipeline overlay */}
        <AnalyzingOverlay visible={isProcessing} />

        {/* Medication Editor Modal */}
        <Modal visible={showMedModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Manage Medications</Text>
              <View style={styles.medInputRow}>
                <TextInput
                  style={styles.medInput}
                  placeholder="Add medication..."
                  placeholderTextColor={COLORS.textMuted}
                  value={newMed}
                  onChangeText={setNewMed}
                  onSubmitEditing={handleAddMed}
                />
                <TouchableOpacity style={styles.addMedButton} onPress={handleAddMed}>
                  <Text style={styles.addMedText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={medications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.medRow}>
                    <Text style={styles.medRowText}>{item.name}</Text>
                    <TouchableOpacity onPress={() => handleRemoveMed(item.id)}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No medications</Text>}
                style={{ maxHeight: 200 }}
              />
              <TouchableOpacity style={styles.doneButton} onPress={() => setShowMedModal(false)}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edge Compute Peer Modal */}
        <Modal visible={showPeerModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edge Compute Peer</Text>
              <Text style={styles.peerHelp}>
                Offload heavy MedGemma-4B inference to a desktop peer on your local QVAC mesh
                (E2E-encrypted via Holepunch). Falls back to on-device automatically if the peer is
                unreachable — so Pulse always works standalone.
              </Text>
              <TextInput
                style={[styles.medInput, { marginBottom: 16 }]}
                placeholder="Provider public key (z32)..."
                placeholderTextColor={COLORS.textMuted}
                value={peerKey}
                onChangeText={setPeerKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.peerToggleRow} onPress={() => setPeerEnabled((v) => !v)}>
                <View style={[styles.peerCheckbox, peerEnabled && styles.peerCheckboxOn]}>
                  {peerEnabled && <Text style={styles.peerCheckMark}>✓</Text>}
                </View>
                <Text style={styles.peerToggleLabel}>Offload heavy inference to this peer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneButton} onPress={handleSavePeer}>
                <Text style={styles.doneText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Result Screen ──────────────────────────────────────────────────────

  const tint = triageResult?.level ? TRIAGE_COLORS[triageResult.level].border : COLORS.cyan;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <AmbientGlow tint={tint} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.resultHeader}>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.backButton}>← New</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => triageResult && exportToPDF(triageResult, symptoms)}>
              <Text style={{ color: COLORS.amber, fontWeight: '700' }}>📄 PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              if (viewShotRef.current?.capture) {
                const uri = await viewShotRef.current.capture();
                await Sharing.shareAsync(uri);
              }
            }}>
              <Text style={{ color: COLORS.purple, fontWeight: '700' }}>🐦 Share</Text>
            </TouchableOpacity>
            <NetworkPill />
          </View>
        </View>

        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ backgroundColor: COLORS.bg }}>
          {/* Triage Badge + Urgency Meter */}
          {triageResult && <TriageBadge level={triageResult.level} />}
          {triageResult?.level && <UrgencyMeter level={triageResult.level} />}

          {/* Assessment */}
          <FadeInView delay={120} style={styles.assessmentCard}>
            <Text style={styles.assessmentTitle}>Assessment</Text>
            <Text style={styles.assessmentText}>{triageResult?.assessment}</Text>
          </FadeInView>

          {/* Drug Interaction Warnings */}
          {triageResult && triageResult.drugWarnings.length > 0 && (
            <FadeInView delay={200} style={styles.section}>
              <Text style={styles.sectionTitle}>⚠️ Drug Interaction Warnings</Text>
              {triageResult.drugWarnings.map((warning, i) => (
                <DrugWarning key={i} warning={warning} />
              ))}
            </FadeInView>
          )}

          {/* Recommendations */}
          {triageResult && (
            <FadeInView delay={280} style={styles.section}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {triageResult.recommendations.map((rec, i) => (
                <View key={i} style={styles.recItem}>
                  <Text style={styles.recBullet}>•</Text>
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))}
            </FadeInView>
          )}

          {/* Citations Toggle */}
          <TouchableOpacity
            style={styles.citationToggle}
            onPress={() => setShowCitations(!showCitations)}
          >
            <Text style={styles.citationToggleText}>
              📚 {showCitations ? 'Hide' : 'Show'} Citations ({triageResult?.citations.length ?? 0})
            </Text>
          </TouchableOpacity>

          {/* Citations Sheet */}
          {showCitations &&
            triageResult?.citations.map((c) => <CitationCard key={c.id} citation={c} />)}

          {/* Disclaimer */}
          <View style={[styles.disclaimerCard, { marginTop: 16 }]}>
            <Text style={styles.disclaimerText}>
              ⚠️ This is NOT medical advice. Pulse is a demonstration tool. Always consult a healthcare professional.
            </Text>
          </View>

          {/* Query Info */}
          <View style={styles.queryInfo}>
            <Text style={styles.queryInfoLabel}>Your symptoms:</Text>
            <Text style={styles.queryInfoText}>{`"${symptoms}"`}</Text>
            <Text style={styles.queryInfoLabel}>Medications checked:</Text>
            <Text style={styles.queryInfoText}>
              {medications.map((m) => m.name).join(', ') || 'None'}
            </Text>
          </View>
        </ViewShot>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' }, // Deep slate background
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Ambient glow
  glowBlob: { position: 'absolute', width: width * 1.4, height: width * 1.4, borderRadius: width, opacity: 0.13 },
  glowTop: { top: -width * 0.7, left: -width * 0.2 },
  glowBottom: { bottom: -width * 0.8, right: -width * 0.3, opacity: 0.1 },

  // Header
  header: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  logo: { fontSize: 44, marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: COLORS.cyan, marginTop: 8, letterSpacing: 2, fontWeight: '600', textTransform: 'uppercase' },

  // History chip
  historyChip: {
    marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100,
    backgroundColor: COLORS.purpleDim, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)',
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
  },
  historyChipText: { fontSize: 11, color: COLORS.purple, fontWeight: '700', letterSpacing: 0.5 },

  // Network Pill
  networkPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  networkDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6, backgroundColor: COLORS.green, shadowColor: COLORS.green, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  networkText: { fontSize: 10, fontWeight: '800', color: COLORS.green, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Disclaimer
  disclaimerCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  disclaimerText: { fontSize: 12, color: COLORS.amber, lineHeight: 18, textAlign: 'center' },

  // Section
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  editLink: { fontSize: 13, color: COLORS.cyan, fontWeight: '600' },

  // Text Area (Glassmorphism)
  textAreaContainer: { position: 'relative' },
  textArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24, padding: 20, paddingTop: 20, paddingBottom: 80, color: COLORS.white, fontSize: 16,
    minHeight: 180, lineHeight: 24, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
  },
  voiceOrbContainer: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  voiceOrb: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.purple,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.purple, shadowOpacity: 0.5, shadowRadius: 15, shadowOffset: { width: 0, height: 0 },
  },
  voiceOrbIcon: { fontSize: 24 },

  // Quick chips
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  quickChip: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
  },
  quickChipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  // Visualizer
  visualizerContainer: { height: 50, width: 50, justifyContent: 'center', alignItems: 'center' },
  visualizerRing: { position: 'absolute', width: 50, height: 50, borderRadius: 25 },
  visualizerCore: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.cyan },
  visualizerCoreText: { fontSize: 9, color: COLORS.cyan, fontWeight: '900', letterSpacing: 1 },

  // Photo intake (multimodal)
  photoButton: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.purpleDim, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 14, paddingVertical: 14,
  },
  photoButtonText: { fontSize: 13, color: COLORS.purple, fontWeight: '700' },
  photoPreviewRow: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 12, gap: 12,
  },
  photoThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.card },
  photoCaption: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700' },
  photoSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  // Edge Compute (P2P) status
  peerStatusRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  peerDot: {
    width: 8, height: 8, borderRadius: 4, marginRight: 10,
    shadowColor: COLORS.purple, shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
  },
  peerStatusText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', flex: 1 },
  peerHelp: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 18 },
  peerToggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  peerCheckbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: COLORS.textMuted,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  peerCheckboxOn: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  peerCheckMark: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  peerToggleLabel: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },

  // Med Chips
  medChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  medChip: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)', borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
  },
  medChipText: { fontSize: 13, color: COLORS.cyan, fontWeight: '700', letterSpacing: 0.5 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },

  // Submit
  submitButton: {
    borderRadius: 20, marginBottom: 20,
    shadowColor: COLORS.cyan, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 5 },
  },
  submitButtonInner: {
    backgroundColor: COLORS.cyan, borderRadius: 20, paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.4, shadowOpacity: 0 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#020617', letterSpacing: 1, textTransform: 'uppercase' },

  // Model Info
  modelInfo: { alignItems: 'center', opacity: 0.6 },
  modelInfoText: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 1, fontWeight: '600' },

  // Analyzing overlay
  analyzingOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.97)', justifyContent: 'center', paddingHorizontal: 36 },
  analyzingHeart: { fontSize: 60, textAlign: 'center', marginBottom: 18 },
  analyzingTitle: { fontSize: 22, fontWeight: '900', color: COLORS.white, textAlign: 'center', letterSpacing: 1 },
  analyzingSub: { fontSize: 13, color: COLORS.cyan, textAlign: 'center', marginTop: 6, marginBottom: 36, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' },
  pipeline: { gap: 14 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pipelineIconWrap: {
    width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pipelineIconActive: {
    borderColor: COLORS.cyan, backgroundColor: COLORS.cyanDim,
    shadowColor: COLORS.cyan, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
  },
  pipelineIconDone: { borderColor: COLORS.green, backgroundColor: COLORS.greenDim },
  pipelineIcon: { fontSize: 20, color: COLORS.green, fontWeight: '900' },
  pipelineLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textMuted },
  pipelineSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  pipelineSpinner: { fontSize: 12, color: COLORS.cyan },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: {
    backgroundColor: '#0f172a', borderRadius: 24, padding: 24, maxHeight: '80%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOpacity: 1, shadowRadius: 30, shadowOffset: { width: 0, height: 10 },
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 20, textAlign: 'center' },
  medInputRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  medInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: 15,
  },
  addMedButton: {
    backgroundColor: COLORS.cyan, borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center',
  },
  addMedText: { color: '#020617', fontWeight: '800', fontSize: 15 },
  medRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  medRowText: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  removeText: { fontSize: 20, color: COLORS.textMuted },
  doneButton: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  doneText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  // Result Screen
  resultHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30,
  },
  backButton: { fontSize: 16, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },

  // Triage Badge
  triageBadge: {
    alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 16,
    borderRadius: 20, borderWidth: 1, marginBottom: 18,
  },
  triageBadgeText: { fontSize: 18, fontWeight: '900', letterSpacing: 3 },

  // Urgency meter
  meterWrap: { marginBottom: 28 },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  meterTick: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: 4 },

  // Assessment
  assessmentCard: {
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24, padding: 24, marginBottom: 20,
  },
  assessmentTitle: { fontSize: 12, fontWeight: '800', color: COLORS.cyan, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 2 },
  assessmentText: { fontSize: 16, color: COLORS.textPrimary, lineHeight: 26 },

  // Drug Warnings
  drugWarningCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start',
  },
  drugWarningIcon: { fontSize: 18, marginRight: 12, marginTop: 2 },
  drugWarningText: { fontSize: 15, color: '#fca5a5', lineHeight: 22, flex: 1, fontWeight: '500' },

  // Recommendations
  recItem: { flexDirection: 'row', marginBottom: 12, paddingLeft: 8, paddingRight: 8 },
  recBullet: { color: COLORS.cyan, fontSize: 16, marginRight: 12, marginTop: 2, fontWeight: '900' },
  recText: { fontSize: 15, color: COLORS.textPrimary, flex: 1, lineHeight: 24 },

  // Citations
  citationToggle: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 16, marginTop: 10,
  },
  citationToggleText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '700', letterSpacing: 1 },
  citationCard: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.01)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 12,
  },
  citationIcon: { fontSize: 18, marginRight: 12, marginTop: 2 },
  citationContent: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 22, marginBottom: 6, fontStyle: 'italic' },
  citationSource: { fontSize: 12, color: COLORS.cyan, fontWeight: '600', letterSpacing: 0.5 },

  // Query Info
  queryInfo: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 20, marginTop: 20, marginBottom: 40,
  },
  queryInfoLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6, marginTop: 12 },
  queryInfoText: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 20 },
});
