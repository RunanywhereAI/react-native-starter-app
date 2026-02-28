import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { DetectedPattern } from '../types/session';
import { AppColors } from '../theme';
import { getPatternDefinition } from '../ai/patternLibrary';

interface SuggestionCardProps {
  pattern: DetectedPattern;
  onDismiss?: () => void;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({ pattern }) => {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const patternDef = getPatternDefinition(pattern.pattern);

  const getSeverityGradient = (): [string, string] => {
    switch (pattern.severity) {
      case 'high': return ['#FF3B30', '#C53030'];
      case 'medium': return ['#FF9F0A', '#D97706'];
      case 'low': return ['#7B61FF', '#9B82FF'];
      default: return ['#7B61FF', '#9B82FF'];
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}>
      <LinearGradient colors={getSeverityGradient()} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.patternName}>{patternDef.displayName}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{Math.round(pattern.confidenceScore)}%</Text></View>
          </View>
          <Text style={styles.description}>{patternDef.description}</Text>
        </View>
        <View style={styles.suggestionBox}>
          <Text style={styles.suggestionLabel}>💡 Suggestion</Text>
          <Text style={styles.suggestionText}>{pattern.suggestion}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 10, borderRadius: 20, overflow: 'hidden', elevation: 6, shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
  gradient: { padding: 16 },
  header: { marginBottom: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  patternName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  description: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  suggestionBox: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 14, borderRadius: 14 },
  suggestionLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  suggestionText: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
});
