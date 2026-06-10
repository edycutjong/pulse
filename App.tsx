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
  const config = TRIAGE_COLORS[level];
  return (
    <View style={[styles.triageBadge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Text style={[styles.triageBadgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function CitationCard({ citation }: { citation: Citation }) {
  return (
    <View style={styles.citationCard}>
      <Text style={styles.citationIcon}>📄</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.citationContent}>{citation.content}</Text>
        <Text style={styles.citationSource}>Source: {citation.source}</Text>
      </View>
    </View>
  );
}

function DrugWarning({ warning }: { warning: string }) {
  return (
    <View style={styles.drugWarningCard}>
      <Text style={styles.drugWarningText}>{warning}</Text>
    </View>
  );
}

function VoiceVisualizer({ isRecording }: { isRecording: boolean }) {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim1, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(anim1, { toValue: 0, duration: 800, useNativeDriver: true })
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim2, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(anim2, { toValue: 0, duration: 1200, useNativeDriver: true })
        ])
      ).start();
    } else {
      anim1.stopAnimation();
      anim2.stopAnimation();
    }
  }, [isRecording]);

  if (!isRecording) return null;

  return (
    <View style={{ height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
      <Animated.View style={{
        position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.cyan,
        opacity: anim1.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.4] }),
        transform: [{ scale: anim1.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }]
      }} />
      <Animated.View style={{
        position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.green,
        opacity: anim2.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] }),
        transform: [{ scale: anim2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }]
      }} />
      <Text style={{ color: COLORS.cyan, fontWeight: '700', marginTop: 80 }}>Listening to symptoms...</Text>
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
      // Real on-device engine: local RAG + deterministic interaction check +
      // MedPsy triage (via @qvac/sdk). Same core as the Node/CLI path.
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
      console.error('[pulse] Triage inference failed:', err);
      setTriageResult({
        level: 'emergency',
        assessment: 'The local AI engine encountered an error. Please seek professional medical help immediately.',
        citations: [],
        drugWarnings: [],
        recommendations: ['Seek professional medical help']
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>🫀</Text>
            <Text style={styles.title}>Pulse</Text>
            <Text style={styles.subtitle}>Offline MedPsy Health Companion</Text>
            <NetworkPill />
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimerCard}>
            <Text style={styles.disclaimerText}>
              ⚠️ Pulse is NOT a medical device. Always consult a healthcare professional for medical advice.
            </Text>
          </View>

          {/* Symptom Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Describe Your Symptoms</Text>
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
          </View>

          {/* Mic Button & Visualizer */}
          {!isRecording ? (
            <TouchableOpacity
              style={styles.micButton}
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
            <Text style={styles.submitText}>
              {isProcessing ? '🔄 Analyzing...' : '🔍 Analyze Symptoms'}
            </Text>
          </TouchableOpacity>

          {/* Model Info */}
          <View style={styles.modelInfo}>
            <Text style={styles.modelInfoText}>Model: MedPsy-1.7B · RAG: GTE-Large-FP16 · 100% Offline</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Header
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { fontSize: 48, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },

  // Network Pill
  networkPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.greenDim,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  networkDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  networkText: { fontSize: 11, fontWeight: '700', color: COLORS.green, letterSpacing: 1.5 },

  // Disclaimer
  disclaimerCard: {
    backgroundColor: COLORS.amberDim, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12, padding: 12, marginBottom: 20,
  },
  disclaimerText: { fontSize: 12, color: COLORS.amber, lineHeight: 18 },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  editLink: { fontSize: 13, color: COLORS.cyan },

  // Text Area
  textArea: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 12, padding: 16, color: COLORS.textPrimary, fontSize: 15,
    minHeight: 100, lineHeight: 22,
  },

  // Mic Button
  micButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.purpleDim, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 12, paddingVertical: 14, marginBottom: 20,
  },
  micIcon: { fontSize: 20, marginRight: 8 },
  micText: { fontSize: 14, color: COLORS.purple, fontWeight: '600' },

  // Med Chips
  medChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  medChip: {
    backgroundColor: COLORS.cyanDim, borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6,
  },
  medChipText: { fontSize: 13, color: COLORS.cyan, fontWeight: '600' },
  emptyText: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },

  // Submit
  submitButton: {
    backgroundColor: COLORS.cyan, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 16,
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitText: { fontSize: 16, fontWeight: '700', color: COLORS.bg },

  // Model Info
  modelInfo: { alignItems: 'center' },
  modelInfoText: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '60%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white, marginBottom: 16 },
  medInputRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  medInput: {
    flex: 1, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: COLORS.textPrimary,
    fontSize: 14,
  },
  addMedButton: {
    backgroundColor: COLORS.cyan, borderRadius: 10, paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addMedText: { color: COLORS.bg, fontWeight: '700', fontSize: 14 },
  medRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  medRowText: { fontSize: 15, color: COLORS.textPrimary },
  removeText: { fontSize: 18, color: COLORS.red, fontWeight: '700' },
  doneButton: {
    backgroundColor: COLORS.cyan, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
  },
  doneText: { color: COLORS.bg, fontWeight: '700', fontSize: 15 },

  // Result Screen
  resultHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  backButton: { fontSize: 15, color: COLORS.cyan, fontWeight: '600' },

  // Triage Badge
  triageBadge: {
    alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 14, borderWidth: 2, marginBottom: 20,
  },
  triageBadgeText: { fontSize: 20, fontWeight: '800', letterSpacing: 2 },

  // Assessment
  assessmentCard: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 14, padding: 18, marginBottom: 20,
  },
  assessmentTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  assessmentText: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 22 },

  // Drug Warnings
  drugWarningCard: {
    backgroundColor: COLORS.redDim, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10, padding: 14, marginBottom: 8,
  },
  drugWarningText: { fontSize: 13, color: COLORS.red, lineHeight: 20 },

  // Recommendations
  recItem: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
  recBullet: { color: COLORS.cyan, fontSize: 14, marginRight: 8, marginTop: 1 },
  recText: { fontSize: 14, color: COLORS.textPrimary, flex: 1, lineHeight: 20 },

  // Citations
  citationToggle: {
    backgroundColor: COLORS.cyanDim, borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12,
  },
  citationToggleText: { fontSize: 13, color: COLORS.cyan, fontWeight: '600' },
  citationCard: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderWidth: 1,
    borderColor: COLORS.cardBorder, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  citationIcon: { fontSize: 16, marginRight: 10, marginTop: 2 },
  citationContent: { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18, marginBottom: 4 },
  citationSource: { fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' },

  // Query Info
  queryInfo: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 12, padding: 14, marginTop: 12,
  },
  queryInfoLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 8 },
  queryInfoText: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },
});
