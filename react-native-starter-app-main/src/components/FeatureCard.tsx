import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native';

interface FeatureCardProps {
  title: string;
  subtitle: string;
  icon?: string;
  iconSize?: number;
  gradientColors?: string[];
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  iconStyle?: StyleProp<TextStyle>;
  onPress?: () => void;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  subtitle,
  icon,
  iconSize,
  style,
  iconStyle,
  onPress,
}) => {

  return (
    <TouchableOpacity onPress={onPress} style={[styles.container, style]} activeOpacity={0.8}>
      <View style={styles.cardInner}>
        <Text style={[styles.icon, iconSize ? { fontSize: iconSize } : {}, iconStyle] as any}>
          {icon || getIconEmoji(title)}
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
};

const getIconEmoji = (title: string): string => {
  const iconMap: Record<string, string> = {
    Chat: '◇',
    Tools: '⎔',
    Speech: '〰',
    Voice: '⚲',
    Pipeline: '✨',
    Clipboard: '▤',
    Speak: '◎',
    Gallery: '◱',
    'Universal Sync': '⟳',
  };
  return iconMap[title] || '⚡';
};



const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(109, 40, 217, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  } as ViewStyle,
  cardInner: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  icon: {
    fontSize: 28,
    marginBottom: 10,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
