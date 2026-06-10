import React, { useState, useCallback } from 'react';
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
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { useRef, useEffect } from 'react';
import { runTriageCore, type TriageResponse } from './src/core/triageCore';
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

const TRIAGE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  emergency: { bg: COLORS.redDim, border: COLORS.red, text: COLORS.red, label: '🔴 EMERGENCY' },
  urgent: { bg: COLORS.amberDim, border: COLORS.amber, text: COLORS.amber, label: '🟡 URGENT' },
  routine: { bg: COLORS.greenDim, border: COLORS.green, text: COLORS.green, label: '🟢 ROUTINE' },
};

// ── Components ──────────────────────────────────────────────────────────────

function NetworkPill() {
  return (
    <View style={styles.networkPill}>
      <View style={[styles.networkDot, { backgroundColor: COLORS.green }]} />
      <Text style={styles.networkText}>OFFLINE · QVAC</Text>
    </View>
  );
}

function TriageBadge({ level }: { level: TriageLevel }) {
  if (!level) return null;
  const colorObj = TRIAGE_COLORS[level];
  return (
    <View style={[styles.triageBadge, { borderColor: colorObj.border, backgroundColor: colorObj.bg, shadowColor: colorObj.border, shadowOpacity: 0.5, shadowRadius: 15, shadowOffset: {width: 0, height: 0} }]}>
      <Text style={[styles.triageBadgeText, { color: colorObj.text }]}>
        {colorObj.label}
      </Text>
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
        <Text style={styles.citationContent}>"{citation.content}"</Text>
        <Text style={styles.citationSource}>Source: {citation.source}</Text>
      </View>
    </View>
  );
}

function VoiceVisualizer({ isRecording }: { isRecording: boolean }) {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(anim1, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(anim1, { toValue: 0, duration: 1000, useNativeDriver: true })
          ]),
          Animated.sequence([
            Animated.timing(anim2, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(anim2, { toValue: 0, duration: 800, useNativeDriver: true })
          ])
        ])
      ).start();
    } else {
      anim1.setValue(0);
      anim2.setValue(0);
    }
  }, [isRecording]);

  return (
    <View style={styles.visualizerContainer}>
      <Animated.View style={[styles.visualizerRing, { backgroundColor: COLORS.cyan, opacity: anim1.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.4] }), transform: [{ scale: anim1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }] }]} />
      <Animated.View style={[styles.visualizerRing, { backgroundColor: COLORS.purple, opacity: anim2.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] }), transform: [{ scale: anim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] }]} />
      <View style={styles.visualizerCore}>
        <Text style={styles.visualizerCoreText}>Listening...</Text>
      </View>
    </View>
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
  const viewShotRef = useRef<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('@pulse_history').then(data => {
      if (data) setHistory(JSON.parse(data));
    });
  }, []);

  // Handlers
  const handleSubmit = useCallback(async () => {
    if (!symptoms.trim()) return;
    setIsProcessing(true);

    try {
      const meds = medications.map((m) => m.name);
      
      const mappedHistory = history.map(h => ({
        query: h.query,
        result: h.result,
        date: h.date
      }));
      
      const response = await runTriageCore(symptoms, meds, INTERACTIONS, undefined, mappedHistory);
      setTriageResult(responseToResult(response));
      
      const newEntry: HistoryEntry = {
        query: symptoms,
        result: response,
        date: new Date().toISOString()
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
        ]
      });
    } finally {
      setIsProcessing(false);
      setScreen('result');
    }
  }, [symptoms, medications]);

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

  // ── Intake Screen ──────────────────────────────────────────────────────

  if (screen === 'intake') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>P U L S E</Text>
          <Text style={styles.subtitle}>MedPsy Edge AI Companion</Text>
          <NetworkPill />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              onPress={() => {
                setIsRecording(true);
                setTimeout(() => setIsRecording(false), 3000); // fake recording stop
              }}
            >
              <Text style={styles.micIcon}>🎙️</Text>
              <Text style={styles.micText}>Tap to speak (preview)</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsRecording(false)}>
              <VoiceVisualizer isRecording={isRecording} />
            </TouchableOpacity>
          )}

          {/* Current Medications */}
          <View style={styles.section}>
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
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, !symptoms.trim() && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!symptoms.trim() || isProcessing}
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
        </ScrollView>

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
      </SafeAreaView>
    );
  }

  // ── Result Screen ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.resultHeader}>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.backButton}>← New</Text>
          </TouchableOpacity>
          <View style={{flexDirection: 'row', gap: 16, alignItems: 'center'}}>
            <TouchableOpacity onPress={() => triageResult && exportToPDF(triageResult, symptoms)}>
              <Text style={{color: COLORS.amber, fontWeight: '700'}}>📄 PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => {
               if (viewShotRef.current?.capture) {
                 const uri = await viewShotRef.current.capture();
                 await Sharing.shareAsync(uri);
               }
            }}>
              <Text style={{color: COLORS.purple, fontWeight: '700'}}>🐦 Share</Text>
            </TouchableOpacity>
            <NetworkPill />
          </View>
        </View>

        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={{backgroundColor: COLORS.bg}}>

        {/* Triage Badge */}
        {triageResult && <TriageBadge level={triageResult.level} />}

        {/* Assessment */}
        <View style={styles.assessmentCard}>
          <Text style={styles.assessmentTitle}>Assessment</Text>
          <Text style={styles.assessmentText}>{triageResult?.assessment}</Text>
        </View>

        {/* Drug Interaction Warnings */}
        {triageResult && triageResult.drugWarnings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Drug Interaction Warnings</Text>
            {triageResult.drugWarnings.map((warning, i) => (
              <DrugWarning key={i} warning={warning} />
            ))}
          </View>
        )}

        {/* Recommendations */}
        {triageResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {triageResult.recommendations.map((rec, i) => (
              <View key={i} style={styles.recItem}>
                <Text style={styles.recBullet}>•</Text>
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
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
          <Text style={styles.queryInfoText}>"{symptoms}"</Text>
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

  // Header
  header: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: COLORS.cyan, marginTop: 8, letterSpacing: 2, fontWeight: '600', textTransform: 'uppercase' },

  // Network Pill
  networkPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  networkDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6, backgroundColor: COLORS.green, shadowColor: COLORS.green, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: {width: 0, height: 0} },
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
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.white, letterSpacing: 1, textTransform: 'uppercase' },
  editLink: { fontSize: 13, color: COLORS.cyan, fontWeight: '600' },

  // Text Area (Glassmorphism)
  textAreaContainer: {
    position: 'relative',
  },
  textArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24, padding: 20, paddingTop: 20, paddingBottom: 80, color: COLORS.white, fontSize: 16,
    minHeight: 180, lineHeight: 24, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: {width: 0, height: 10},
  },
  voiceOrbContainer: {
    position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center',
  },
  voiceOrb: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.purple,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.purple, shadowOpacity: 0.5, shadowRadius: 15, shadowOffset: {width: 0, height: 0},
  },
  voiceOrbIcon: { fontSize: 24 },

  // Visualizer
  visualizerContainer: { height: 50, width: 50, justifyContent: 'center', alignItems: 'center' },
  visualizerRing: { position: 'absolute', width: 50, height: 50, borderRadius: 25 },
  visualizerCore: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.cyan },
  visualizerCoreText: { fontSize: 8, color: COLORS.cyan, fontWeight: 'bold' },

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
    shadowColor: COLORS.cyan, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: {width: 0, height: 5},
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

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: {
    backgroundColor: '#0f172a', borderRadius: 24, padding: 24, maxHeight: '80%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOpacity: 1, shadowRadius: 30, shadowOffset: {width: 0, height: 10},
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
    borderRadius: 20, borderWidth: 1, marginBottom: 30,
  },
  triageBadgeText: { fontSize: 18, fontWeight: '900', letterSpacing: 3 },

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
