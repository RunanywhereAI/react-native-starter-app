import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { AppColors } from '../theme';

interface CognitiveMeterProps {
  focusScore: number;
  size?: number;
  showLabel?: boolean;
}

export const CognitiveMeter: React.FC<CognitiveMeterProps> = ({ focusScore, size = 100, showLabel = true }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, { toValue: focusScore, duration: 1000, useNativeDriver: false }).start();
  }, [focusScore, animatedValue]);

  const getColor = () => {
    if (focusScore >= 80) return '#34C759';
    if (focusScore >= 60) return '#F5A623';
    return '#FF3B30';
  };

  const getLabelColor = () => {
    if (focusScore >= 80) return '#2DA44E';
    if (focusScore >= 60) return '#D4901A';
    return '#D32F2F';
  };

  const getPillBg = () => {
    if (focusScore >= 80) return 'rgba(52,199,89,0.15)';
    if (focusScore >= 60) return 'rgba(245,166,35,0.15)';
    return 'rgba(255,59,48,0.15)';
  };

  const getLabel = () => {
    if (focusScore >= 80) return 'High Focus';
    if (focusScore >= 60) return 'Moderate';
    return 'Low Focus';
  };

  const scoreFontSize = Math.round(size * 0.28);
  const percentFontSize = Math.round(size * 0.16);

  return (
    <View style={styles.wrapper}>
      {/* Circle container — fixed size for the donut */}
      <View style={[styles.circleContainer, { width: size, height: size }]}>
        {/* Background track */}
        <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderWidth: 8, borderColor: '#EDE9FE' }]} />
        {/* Animated progress arc */}
        <Animated.View style={[styles.circle, {
          width: size, height: size, borderRadius: size / 2, borderWidth: 8,
          borderColor: getColor(), borderTopColor: 'transparent',
          transform: [{ rotate: animatedValue.interpolate({ inputRange: [0, 100], outputRange: ['0deg', '360deg'] }) }],
        }]} />
        {/* Center text overlay */}
        <View style={styles.overlay}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreText, { fontSize: scoreFontSize, lineHeight: scoreFontSize }]}>
              {Math.round(focusScore)}
            </Text>
            <Text style={[styles.percentText, { fontSize: percentFontSize, lineHeight: percentFontSize }]}>
              %
            </Text>
          </View>
        </View>
      </View>

      {/* Status label */}
      {showLabel && (
        <Text style={[styles.statusText, { color: getColor() }]}>
          {getLabel()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  circleContainer: {
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreText: {
    fontWeight: '700',
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  percentText: {
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    includeFontPadding: false,
    textAlignVertical: 'center',
    marginLeft: 1,
  },
  statusText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
