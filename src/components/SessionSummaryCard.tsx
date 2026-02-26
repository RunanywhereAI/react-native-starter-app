import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Session } from '../types/session';
import { AppColors } from '../theme';
import { getModeConfig } from '../ai/patternLibrary';

interface SessionSummaryCardProps {
  session: Session;
  onPress: () => void;
}

/**
 * SessionSummaryCard - Transaction-style session card (like the reference image)
 */
export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({ session, onPress }) => {
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      return 'Today, ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday, ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
        date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    return `${minutes}min`;
  };

  const getFocusColor = (score: number): string => {
    if (score >= 80) return '#34C759';
    if (score >= 60) return '#FF9F0A';
    return '#FF3B30';
  };

  const getIconBg = (index: number): string => {
    const colors = ['#EDE9FE', '#DCFCE7', '#FEF3C7', '#FCE7F3', '#DBEAFE'];
    return colors[index % colors.length];
  };

  const modeConfig = getModeConfig(session.mode);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.container}>
      {/* Icon */}
      <View style={[styles.iconCircle, { backgroundColor: getIconBg(session.timestamp % 5) }]}>
        <Text style={styles.modeIcon}>{modeConfig.icon}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.modeName}>{modeConfig.displayName}</Text>
        <Text style={styles.date}>{formatDate(session.timestamp)}</Text>
      </View>

      {/* Score */}
      <View style={styles.scoreContainer}>
        <Text style={[styles.score, { color: getFocusColor(session.cognitiveMetrics.focusScore) }]}>
          {Math.round(session.cognitiveMetrics.focusScore)}%
        </Text>
        <Text style={styles.duration}>{formatDuration(session.duration)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modeIcon: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  modeName: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textPrimary,
    marginBottom: 3,
  },
  date: {
    fontSize: 12,
    color: AppColors.textMuted,
    fontWeight: '400',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  score: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  duration: {
    fontSize: 11,
    color: AppColors.textMuted,
    fontWeight: '500',
  },
});
