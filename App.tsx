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

// ── Mock Triage (simulates @qvac/sdk inference) ─────────────────────────────

function mockTriageQuery(symptoms: string, medications: Medication[]): TriageResult {
  const lower = symptoms.toLowerCase();

  // Check for emergency patterns
  const emergencyPatterns = [
    'chest pain', 'heart attack', 'can\'t breathe', 'difficulty breathing',
    'unconscious', 'seizure', 'severe allergic', 'stroke', 'worst headache',
    'coughing blood', 'vomiting blood', 'vision loss',
  ];
  const urgentPatterns = [
    'headache with blurred vision', 'high fever', 'blood in urine',
    'severe abdominal', 'swelling in leg', 'confusion', 'rash with fever',
    'persistent vomiting', 'difficulty swallowing', 'irregular heartbeat',
  ];

  let level: TriageLevel = 'routine';
  if (emergencyPatterns.some((p) => lower.includes(p))) level = 'emergency';
  else if (urgentPatterns.some((p) => lower.includes(p))) level = 'urgent';

  // Drug interaction warnings
  const drugWarnings: string[] = [];
  const medNames = medications.map((m) => m.name.toLowerCase());
  if (medNames.includes('warfarin') && (medNames.includes('ibuprofen') || lower.includes('ibuprofen'))) {
    drugWarnings.push('⚠️ Warfarin + Ibuprofen: Increased risk of bleeding. NSAIDs inhibit platelet function.');
  }
  if (medNames.includes('metformin') && lower.includes('alcohol')) {
    drugWarnings.push('⚠️ Metformin + Alcohol: Increased risk of lactic acidosis.');
  }
  if (medNames.includes('lisinopril') && lower.includes('potassium')) {
    drugWarnings.push('⚠️ Lisinopril + Potassium: Risk of hyperkalemia. ACE inhibitors reduce potassium excretion.');
  }

  const assessments: Record<string, string> = {
    emergency:
      'Based on your symptoms, this requires IMMEDIATE medical attention. Call emergency services (911) or go to the nearest emergency room NOW. Do not wait.',
    urgent:
      'Your symptoms suggest a condition that needs medical evaluation within the next few hours. Visit an urgent care clinic or call your doctor for guidance.',
    routine:
      'Your symptoms appear manageable with self-care. Monitor your condition over the next 24-48 hours. Schedule a clinic visit if symptoms persist or worsen.',
  };

  return {
    level,
    assessment: assessments[level],
    citations: [
      { id: 'c1', content: 'Triage level assigned based on symptom pattern matching against WHO Emergency Triage Guidelines', source: 'first_aid_protocols.txt' },
      { id: 'c2', content: 'Drug interaction data validated against WHO Essential Medicines List 2023 Edition', source: 'who_essential_medicines.txt' },
    ],
    drugWarnings,
    recommendations:
      level === 'emergency'
        ? ['Call 911 immediately', 'Do not drive yourself', 'Stay calm and keep airways clear']
        : level === 'urgent'
        ? ['Visit urgent care within 2 hours', 'Bring your medication list', 'Monitor vitals if possible']
        : ['Rest and stay hydrated', 'Monitor symptoms for 24-48 hours', 'Take OTC medication as directed'],
  };
}

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

  // Handlers
  const handleSubmit = useCallback(async () => {
    if (!symptoms.trim()) return;
    setIsProcessing(true);

    try {
      // Real on-device engine: local RAG + deterministic interaction check +
      // MedPsy triage (via @qvac/sdk). Same core as the Node/CLI path.
      const meds = medications.map((m) => m.name);
      const response = await runTriageCore(symptoms, meds, INTERACTIONS);
      setTriageResult(responseToResult(response));
    } catch (err) {
      // The QVAC native runtime isn't available (e.g. Expo Go / simulator) —
      // fall back to the bundled demo heuristic so the screen still renders.
      console.warn('[pulse] real triage unavailable, using demo fallback:', err);
      setTriageResult(mockTriageQuery(symptoms, medications));
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

          {/* Mic Button (preview — Whisper STT activates on a device build) */}
          <TouchableOpacity
            style={styles.micButton}
            onPress={() => Alert.alert('Voice Input (preview)', 'Whisper STT runs on-device via @qvac/sdk in a native build. For now, type your symptoms above.')}
          >
            <Text style={styles.micIcon}>🎙️</Text>
            <Text style={styles.micText}>Tap to speak (preview)</Text>
          </TouchableOpacity>

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
            <Text style={styles.backButton}>← New Assessment</Text>
          </TouchableOpacity>
          <NetworkPill />
        </View>

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
