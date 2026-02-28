import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import { AppColors } from '../theme';
import { getModeConfig } from '../ai/patternLibrary';

type PreSessionStrategyRouteProp = RouteProp<RootStackParamList, 'PreSessionStrategy'>;
type PreSessionStrategyNavigationProp = StackNavigationProp<RootStackParamList, 'PreSessionStrategy'>;

interface Props {
  route: PreSessionStrategyRouteProp;
  navigation: PreSessionStrategyNavigationProp;
}

export const PreSessionStrategyScreen: React.FC<Props> = ({ route, navigation }) => {
  const { mode, inputs, analysis } = route.params;
  const modeConfig = getModeConfig(mode);

  const handleStartSession = () => {
    // Navigate to actual Live Recording passing the pre-session analysis forward
    navigation.replace('LiveSession', { 
      mode,
      preSessionInputs: inputs,
      strategicAnalysis: analysis
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#131A2A', '#1A233A']} style={styles.gradient}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.header}>
            <Text style={styles.subtitle}>OFFLINE INTELLIGENCE MODE</Text>
            <Text style={styles.title}>Strategic Plan: {modeConfig.displayName}</Text>
          </View>

          {/* 1. Power Positioning summary */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>1. Power Positioning</Text>
            <View style={styles.cardPrimary}>
              <Text style={styles.cardTextPrimary}>{analysis.powerPositioning}</Text>
            </View>
          </View>

          {/* 2. Opening Script */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>2. Opening Statement Script</Text>
            <LinearGradient colors={['rgba(16, 185, 129, 0.1)', 'rgba(52, 211, 153, 0.05)']} style={styles.scriptBox}>
              <Text style={styles.scriptText}>{analysis.openingScript}</Text>
            </LinearGradient>
          </View>

          {/* 3 & 4. Objections & Responses */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>3. Likely Objections & Hard Counters</Text>
            {analysis.likelyObjections.map((obj, i) => (
              <View key={i} style={styles.objectionCard}>
                <Text style={styles.objectionLabel}>If they say:</Text>
                <Text style={styles.objectionText}>{obj}</Text>
                
                <View style={styles.divider} />
                
                <Text style={styles.responseLabel}>Strategic Counter:</Text>
                <Text style={styles.responseText}>{analysis.recommendedResponses[i]}</Text>
              </View>
            ))}
          </View>

          {/* 5. Target Phrases */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>4. High-Impact Phrases to Inject</Text>
            <View style={styles.wrapContainer}>
              {analysis.highImpactPhrases.map((phrase, i) => (
                <View key={i} style={styles.goodBadge}>
                  <Text style={styles.goodBadgeText}>{phrase}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 6. Words to Avoid */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>5. Phrases to Avoid</Text>
            <View style={styles.wrapContainer}>
              {analysis.phrasesToAvoid.map((phrase, i) => (
                <View key={i} style={styles.badBadge}>
                  <Text style={styles.badBadgeText}>{phrase}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 7. Psychological Tactics */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>6. Opponent's Psychological Tactics</Text>
            <View style={styles.cardSecondary}>
              {analysis.psychologicalTactics.map((tactic, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.bulletText}>{tactic}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 8. Confidence Triggers */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>7. Confidence Triggers</Text>
            <View style={styles.cardSecondary}>
              {analysis.confidenceTriggers.map((tactic, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.bulletText}>{tactic}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 9. Mistakes to Avoid */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>8. Fatal Mistakes To Avoid</Text>
            <View style={styles.cardError}>
              {analysis.mistakesToAvoid.map((mistake, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.errorBulletPoint}>!</Text>
                  <Text style={styles.errorText}>{mistake}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 10. Closing Script */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>9. Closing Script (To force commitment)</Text>
            <LinearGradient colors={['rgba(123, 97, 255, 0.15)', 'rgba(155, 130, 255, 0.05)']} style={styles.scriptBox}>
              <Text style={styles.scriptText}>{analysis.closingScript}</Text>
            </LinearGradient>
          </View>

          {/* ACTION BUTTON */}
          <TouchableOpacity 
            style={styles.startButton}
            onPress={handleStartSession}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#E11D48', '#BE123C']} // Strong Red for Live mode
              style={styles.startGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
               <View style={styles.buttonStack}>
                <Text style={styles.startButtonText}>Begin Target Session ›</Text>
                <Text style={styles.startButtonSubtext}>Start local microphone tracking</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ height: 40 }} />

        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60, paddingTop: 60 },
  
  header: { marginBottom: 32 },
  subtitle: { color: AppColors.accentPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },

  section: { marginBottom: 32 },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: '#E6EDF3', marginBottom: 16 },

  cardPrimary: { backgroundColor: '#161B22', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#30363D' },
  cardTextPrimary: { color: '#FFFFFF', fontSize: 16, lineHeight: 24, fontWeight: '500' },

  scriptBox: { borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(123, 97, 255, 0.3)' },
  scriptText: { color: '#FFFFFF', fontSize: 18, fontStyle: 'italic', fontWeight: 'bold', lineHeight: 26 },

  objectionCard: { backgroundColor: '#161B22', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#30363D', marginBottom: 16 },
  objectionLabel: { color: '#F87171', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  objectionText: { color: '#FFFFFF', fontSize: 16, fontStyle: 'italic', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#30363D', marginBottom: 16 },
  responseLabel: { color: '#10B981', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  responseText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', lineHeight: 24 },

  wrapContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goodBadge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  goodBadgeText: { color: '#10B981', fontSize: 14, fontWeight: '600' },
  
  badBadge: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  badBadgeText: { color: '#F87171', fontSize: 14, fontWeight: '600', textDecorationLine: 'line-through' },

  cardSecondary: { backgroundColor: '#161B22', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#30363D' },
  cardError: { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  bulletPoint: { color: '#8B949E', fontSize: 16, marginRight: 10, marginTop: 2 },
  bulletText: { color: '#C9D1D9', fontSize: 15, lineHeight: 22, flex: 1 },

  errorBulletPoint: { color: '#F87171', fontSize: 16, marginRight: 10, fontWeight: 'bold' },
  errorText: { color: '#F87171', fontSize: 15, lineHeight: 22, flex: 1, fontWeight: '500' },

  startButton: { borderRadius: 16, overflow: 'hidden', elevation: 8, shadowColor: '#E11D48', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  startGradient: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  buttonStack: { alignItems: 'center' },
  startButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  startButtonSubtext: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 13, fontWeight: '600' }
});
