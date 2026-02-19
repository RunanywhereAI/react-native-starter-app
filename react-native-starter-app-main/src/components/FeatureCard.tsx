import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme';

interface FeatureCardProps {
  title: string;
  subtitle: string;
  icon: string;
  gradientColors: string[];
  onPress: () => void;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  subtitle,
  gradientColors,
  onPress,
}) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.8}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.icon}>{getIconEmoji(title)}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// Helper to get emoji icon based on title
const getIconEmoji = (title: string): string => {
  const iconMap: Record<string, string> = {
    Chat: '💬',
    Tools: '🛠',
    Speech: '🎤',
    Voice: '🔊',
    Pipeline: '✨',
  };
  return iconMap[title] || '⚡';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 8,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: AppColors.accentCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  } as ViewStyle,
  gradient: {
    padding: 20,
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
});
