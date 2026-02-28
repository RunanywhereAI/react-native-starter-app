import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { AppColors } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { Session } from '../types/session';
import { useSessionAnalyzer } from '../hooks/useSessionAnalyzer';
import { getModeConfig, getPatternDefinition } from '../ai/patternLibrary';
import { CognitiveMeter } from '../components/CognitiveMeter';

type InsightsScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Insights'>;
  route: RouteProp<RootStackParamList, 'Insights'>;
};

export const InsightsScreen: React.FC<InsightsScreenProps> = ({ navigation, route }) => {
  const { sessionId } = route.params;
  const { getSession, deleteSession } = useSessionAnalyzer();
  const [session, setSession] = useState<Session | null>(null);
  const [selectedTab, setSelectedTab] = useState<'transcript' | 'patterns' | 'analysis'>('analysis');

  useEffect(() => { loadSession(); }, [sessionId]);

  const loadSession = async () => {
    const s = await getSession(sessionId);
    if (s) setSession(s);
    else Alert.alert('Error', 'Session not found', [{ text: 'OK', onPress: () => navigation.goBack() }]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Session', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSession(sessionId); navigation.goBack(); } },
    ]);
  };

  if (!session) return (
    <View style={[styles.container, styles.centered]}>
      <Text style={styles.loadingText}>Loading session...</Text>
    </View>
  );

  const modeConfig = getModeConfig(session.mode);
  const formatDate = (t: number) => new Date(t).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatDuration = (ms: number) => { const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); return `${m}m ${s}s`; };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7B61FF" />

      {/* Header */}
      <LinearGradient colors={['#7B61FF', '#9B82FF', '#B19CFF']} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.modeTag}>
            <Text style={styles.modeIcon}>{modeConfig.icon}</Text>
            <Text style={styles.modeText}>{modeConfig.displayName}</Text>
          </View>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.dateText}>{formatDate(session.timestamp)}</Text>
        <View style={styles.statsRow}>
          <View style={styles.headerStatCard}>
            <Text style={styles.headerStatLabel}>Duration</Text>
            <Text style={styles.headerStatValue}>{formatDuration(session.duration)}</Text>
          </View>
          <View style={styles.headerStatCard}>
            <Text style={styles.headerStatLabel}>Patterns</Text>
            <Text style={styles.headerStatValue}>{session.detectedPatterns.length}</Text>
          </View>
          <View style={styles.headerStatCard}>
            <Text style={styles.headerStatLabel}>Words</Text>
            <Text style={styles.headerStatValue}>{session.cognitiveMetrics.totalWords}</Text>
          </View>
        </View>
        <View style={styles.focusSection}>
          <CognitiveMeter focusScore={session.cognitiveMetrics.focusScore} size={80} />
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['analysis', 'patterns', 'transcript'] as const).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, selectedTab === tab && styles.tabActive]} onPress={() => setSelectedTab(tab)}>
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {selectedTab === 'analysis' && (
          <View>
            {session.summary.keyInsights.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💡 Key Insights</Text>
                {session.summary.keyInsights.map((insight, i) => (
                  <View key={i} style={styles.insightCard}>
                    <View style={styles.insightAccent} />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>
            )}
            {session.summary.tacticalSuggestions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎯 Tactical Suggestions</Text>
                {session.summary.tacticalSuggestions.map((s, i) => (
                  <View key={i} style={styles.suggestionCard}>
                    <View style={styles.suggestionNum}><Text style={styles.suggestionNumText}>{i + 1}</Text></View>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
            {session.summary.leverageMoments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✅ Leverage Moments</Text>
                {session.summary.leverageMoments.map((m, i) => (
                  <View key={i} style={styles.momentCard}><Text style={styles.momentText}>{m}</Text></View>
                ))}
              </View>
            )}
            {session.summary.missedOpportunities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚠️ Missed Opportunities</Text>
                {session.summary.missedOpportunities.map((o, i) => (
                  <View key={i} style={styles.oppCard}><Text style={styles.oppText}>{o}</Text></View>
                ))}
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🧠 Cognitive Metrics</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}><Text style={styles.metricValue}>{session.cognitiveMetrics.speechGaps}</Text><Text style={styles.metricLabel}>Speech Gaps</Text></View>
                <View style={styles.metricCard}><Text style={styles.metricValue}>{session.cognitiveMetrics.fillerWords}</Text><Text style={styles.metricLabel}>Filler Words</Text></View>
                <View style={styles.metricCard}><Text style={styles.metricValue}>{Math.round(session.cognitiveMetrics.avgSpeechRate)}</Text><Text style={styles.metricLabel}>WPM</Text></View>
              </View>
            </View>
          </View>
        )}
        {selectedTab === 'patterns' && (
          <View>
            {session.detectedPatterns.map((p) => {
              const d = getPatternDefinition(p.pattern);
              return (
                <View key={p.id} style={styles.patternCard}>
                  <View style={styles.patternHeader}>
                    <Text style={styles.patternName}>{d.displayName}</Text>
                    <View style={styles.patternBadge}><Text style={styles.patternBadgeText}>{Math.round(p.confidenceScore)}%</Text></View>
                  </View>
                  <Text style={styles.patternDesc}>{d.description}</Text>
                  <View style={styles.patternSugg}><Text style={styles.patternSuggLabel}>Suggestion:</Text><Text style={styles.patternSuggText}>{p.suggestion}</Text></View>
                  {p.context && <View style={styles.patternCtx}><Text style={styles.patternCtxText}>"{p.context}"</Text></View>}
                </View>
              );
            })}
            {session.detectedPatterns.length === 0 && <View style={styles.emptyState}><Text style={styles.emptyText}>No patterns detected</Text></View>}
          </View>
        )}
        {selectedTab === 'transcript' && (
          <View>
            {session.transcript.map((c) => (
              <View key={c.id} style={styles.tChunk}>
                <Text style={styles.tTime}>{new Date(c.timestamp).toLocaleTimeString()}</Text>
                <Text style={styles.tText}>{c.text}</Text>
              </View>
            ))}
            {session.transcript.length === 0 && <View style={styles.emptyState}><Text style={styles.emptyText}>No transcript available</Text></View>}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.primaryLight },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: AppColors.textSecondary },

  header: { paddingTop: 50, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modeTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  modeIcon: { fontSize: 16, marginRight: 6 },
  modeText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  deleteButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  deleteIcon: { fontSize: 20 },
  dateText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 16 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  headerStatCard: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14 },
  headerStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: '500' },
  headerStatValue: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  focusSection: { alignItems: 'center' },

  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 4, paddingVertical: 4, marginHorizontal: 16, borderRadius: 16, marginTop: -6, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: '#7B61FF' },
  tabText: { fontSize: 14, fontWeight: '600', color: AppColors.textSecondary },
  tabTextActive: { color: '#FFFFFF' },

  content: { flex: 1 },
  contentContainer: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: AppColors.textPrimary, marginBottom: 12 },

  insightCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 8, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  insightAccent: { width: 4, backgroundColor: '#7B61FF' },
  insightText: { flex: 1, fontSize: 14, color: AppColors.textPrimary, lineHeight: 20, padding: 14 },

  suggestionCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, marginBottom: 8, alignItems: 'flex-start', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  suggestionNum: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  suggestionNumText: { fontSize: 14, fontWeight: '700', color: '#7B61FF' },
  suggestionText: { flex: 1, fontSize: 14, color: AppColors.textPrimary, lineHeight: 20 },

  momentCard: { backgroundColor: '#DCFCE7', padding: 14, borderRadius: 14, marginBottom: 8 },
  momentText: { fontSize: 13, color: '#166534', lineHeight: 18 },
  oppCard: { backgroundColor: '#FEF3C7', padding: 14, borderRadius: 14, marginBottom: 8 },
  oppText: { fontSize: 13, color: '#92400E', lineHeight: 18 },

  metricsGrid: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 18, borderRadius: 18, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  metricValue: { fontSize: 24, fontWeight: '700', color: '#7B61FF', marginBottom: 6 },
  metricLabel: { fontSize: 11, color: AppColors.textSecondary, textAlign: 'center', fontWeight: '500' },

  patternCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  patternHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  patternName: { fontSize: 16, fontWeight: '700', color: AppColors.textPrimary, flex: 1 },
  patternBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  patternBadgeText: { fontSize: 12, fontWeight: '700', color: '#7B61FF' },
  patternDesc: { fontSize: 13, color: AppColors.textSecondary, marginBottom: 10, lineHeight: 18 },
  patternSugg: { backgroundColor: '#F8F5FF', padding: 12, borderRadius: 12, marginBottom: 8 },
  patternSuggLabel: { fontSize: 11, fontWeight: '600', color: AppColors.textMuted, marginBottom: 4 },
  patternSuggText: { fontSize: 13, color: AppColors.textPrimary, lineHeight: 18 },
  patternCtx: { padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#7B61FF' },
  patternCtxText: { fontSize: 12, fontStyle: 'italic', color: AppColors.textSecondary, lineHeight: 16 },

  tChunk: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tTime: { fontSize: 12, color: AppColors.textMuted, marginBottom: 6, fontWeight: '500' },
  tText: { fontSize: 15, color: AppColors.textPrimary, lineHeight: 22 },

  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: AppColors.textSecondary },
});
