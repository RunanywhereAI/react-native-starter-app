import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppColors } from '../theme';

interface AudioVisualizerProps {
  level: number; // 0.0 to 1.0
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  level,
  barCount = 7,
}) => {
  const bars = Array.from({ length: barCount }, (_, i) => {
    // Create wave effect
    const waveEffect = Math.sin((i / barCount) * Math.PI);
    const height = Math.max(0.2, level * waveEffect);
    return height;
  });

  return (
    <View style={styles.container}>
      {bars.map((height, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height: `${height * 100}%`,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 6,
  },
  bar: {
    width: 6,
    backgroundColor: AppColors.accentViolet,
    borderRadius: 3,
    minHeight: 12,
  },
});
