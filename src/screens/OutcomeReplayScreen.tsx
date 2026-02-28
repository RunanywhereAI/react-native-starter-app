import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import { AppColors } from '../theme';
import { useSessionAnalyzer } from '../hooks/useSessionAnalyzer';
import { OutcomeReplayEngine, ReplaySimulationResult } from '../ai/OutcomeReplayEngine';
import { BehavioralAnalyticsEngine, BehavioralProfile } from '../ai/BehavioralAnalyticsEngine';

type OutcomeReplayScreenRouteProp = RouteProp<RootStackParamList, 'OutcomeReplay'>;
type OutcomeReplayScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OutcomeReplay'>;

interface OutcomeReplayScreenProps {
  route: OutcomeReplayScreenRouteProp;
  navigation: OutcomeReplayScreenNavigationProp;
}

export const OutcomeReplayScreen: React.FC<OutcomeReplayScreenProps> = ({ route, navigation }) => {
  const { sessionId } = route.params;
  const { getSession } = useSessionAnalyzer();
  const [loading, setLoading] = useState(true);
  const [simulation, setSimulation] = useState<ReplaySimulationResult | null>(null);
  const [profile, setProfile] = useState<BehavioralProfile | null>(null);

  useEffect(() => {
    const loadEngines = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      const session = await getSession(sessionId);
      if (session) {
        setSimulation(OutcomeReplayEngine.generateSimulation(session));
        setProfile(BehavioralAnalyticsEngine.analyzeTranscript(session));
      }
      setLoading(false);
    };
    loadEngines();
  }, [sessionId, getSession]);

  if (loading || !simulation || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.accentViolet} />
        <Text style={styles.loadingText}>Running Counterfactual Simulations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0E1A', '#131A2A', '#1A233A']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.subtitle}>SESSION ANALYSIS</Text>
            <Text style={styles.title}>Strategic Outcome Replay™</Text>
          </View>

          {/* SECTION 3: Behavioral Performance Profile */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Behavioral Performance Profile</Text>
            <View style={styles.profileCard}>
              <View style={styles.archetypeContainer}>
                {profile.archetype.map((trait, index) => (
                  <View key={index} style={styles.badge}>
                    <Text style={styles.badgeText}>{trait}</Text>
                  </View>
                ))}
              </View>
              
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Leverage Score</Text>
                  <Text style={[styles.statValue, { color: profile.leverageCaptureScore > 70 ? AppColors.success : AppColors.error }]}>
                    {profile.leverageCaptureScore}%
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Hesitations</Text>
                  <Text style={styles.statValueAlt}>{profile.hesitationMoments}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Filler Words</Text>
                  <Text style={styles.statValueAlt}>{profile.fillerWordCount}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* SECTION 4: Post-Session Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Tactical Post-Session Summary</Text>
            
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>What Worked</Text>
              {simulation.postSessionSummary.whatWorked.map((item, idx) => (
                <View key={`worked-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletPointSuccess}>✓</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <Text style={styles.summaryLabel}>Signals of Interest</Text>
              {simulation.postSessionSummary.signalsOfInterest.map((item, idx) => (
                <View key={`signal-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletPointPrimary}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <Text style={styles.summaryLabel}>Hidden Objections Detected</Text>
              {simulation.postSessionSummary.hiddenObjections.map((item, idx) => (
                <View key={`hidden-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletPointWarning}>!</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <Text style={styles.summaryLabel}>Follow-up Strategy</Text>
              <LinearGradient colors={['rgba(123, 97, 255, 0.15)', 'rgba(155, 130, 255, 0.05)']} style={styles.strategyBox}>
                <Text style={styles.strategyText}>{simulation.postSessionSummary.followUpStrategy}</Text>
              </LinearGradient>
            </View>
          </View>

          {/* SECTION 1 & 2: Tactical Missed Opportunities & Improvement Simulation */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Tactical Counterfactuals</Text>
            
            {simulation.opportunities.length === 0 ? (
               <View style={styles.emptyCard}>
                 <Text style={styles.emptyText}>No major tactical errors detected.</Text>
               </View>
            ) : (
                simulation.opportunities.map((opp, idx) => (
                    <View key={idx} style={styles.simulationCard}>
                        {/* Type Label */}
                        <View style={styles.tacticLabelContainer}>
                            <Text style={styles.tacticLabelText}>{opp.tacticType.replace('_', ' ')}</Text>
                        </View>

                        {/* Original String */}
                        <Text style={styles.oppTitle}>Original Response</Text>
                        <Text style={styles.originalQuote}>"{opp.originalQuote}"</Text>

                        {/* Improved Sim */}
                        <LinearGradient colors={['rgba(16, 185, 129, 0.1)', 'rgba(52, 211, 153, 0.05)']} style={styles.improvedBox}>
                            <Text style={styles.oppTitleGood}>Improved Strategic Framing</Text>
                            <Text style={styles.improvedQuote}>"{opp.improvedReframing}"</Text>
                            
                            <View style={styles.deltaBox}>
                                <Text style={styles.deltaLabel}>Persuasion Strength:</Text>
                                <Text style={styles.deltaScores}>
                                    <Text style={styles.deltaBad}>{opp.originalStrengthScore}%</Text> 
                                    {' → '} 
                                    <Text style={styles.deltaGood}>{opp.improvedStrengthScore}%</Text>
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>
                ))
            )}
          </View>

          {/* Next Session Reccomendations */}
           <TouchableOpacity 
             style={styles.doneButton} 
             onPress={() => navigation.navigate('Home')}
           >
             <Text style={styles.doneButtonText}>Return to Dashboard</Text>
           </TouchableOpacity>

        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  loadingContainer: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8B949E', marginTop: 16, fontSize: 16 },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60, paddingTop: 60 },
  header: { marginBottom: 32 },
  subtitle: { color: '#8B949E', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  section: { marginBottom: 36 },
  sectionHeader: { fontSize: 20, fontWeight: '700', color: '#E6EDF3', marginBottom: 16 },
  
  // Profile
  profileCard: { backgroundColor: '#161B22', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#30363D' },
  archetypeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  badge: { backgroundColor: 'rgba(123, 97, 255, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(123, 97, 255, 0.3)' },
  badgeText: { color: '#B19CFF', fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#30363D', paddingTop: 16 },
  statBox: { alignItems: 'center' },
  statLabel: { color: '#8B949E', fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statValueAlt: { color: '#E6EDF3', fontSize: 24, fontWeight: '700' },

  // Counterfactuals
  simulationCard: { backgroundColor: '#161B22', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#30363D', marginBottom: 16 },
  tacticLabelContainer: { alignSelf: 'flex-start', backgroundColor: '#30363D', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 16 },
  tacticLabelText: { color: '#C9D1D9', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  oppTitle: { color: '#8B949E', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  originalQuote: { color: '#E6EDF3', fontSize: 16, fontStyle: 'italic', lineHeight: 24, marginBottom: 20 },
  improvedBox: { borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  oppTitleGood: { color: '#10B981', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  improvedQuote: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', lineHeight: 24, marginBottom: 16 },
  deltaBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 },
  deltaLabel: { color: '#8B949E', fontSize: 13, fontWeight: '600' },
  deltaScores: { fontSize: 16, fontWeight: '700' },
  deltaBad: { color: AppColors.error },
  deltaGood: { color: '#10B981' },

  emptyCard: { padding: 20, backgroundColor: '#161B22', borderRadius: 12, alignItems: 'center' },
  emptyText: { color: '#8B949E' },

  doneButton: { backgroundColor: AppColors.accentPrimary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bulletText: {
    color: '#e0e0e0',
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#333333',
    marginVertical: 12,
  },

  // Summary Card
  summaryCard: { backgroundColor: '#161B22', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#30363D' },
  summaryLabel: { color: '#8B949E', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  bulletPointSuccess: { color: '#10B981', fontSize: 16, marginRight: 10, marginTop: 1, fontWeight: '700' },
  bulletPointPrimary: { color: AppColors.accentPrimary, fontSize: 16, marginRight: 10, marginTop: 1, fontWeight: '700' },
  bulletPointWarning: { color: '#F59E0B', fontSize: 16, marginRight: 10, marginTop: 1, fontWeight: '700' },
  strategyBox: { borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(123, 97, 255, 0.3)' },
  strategyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', lineHeight: 22 },
});
