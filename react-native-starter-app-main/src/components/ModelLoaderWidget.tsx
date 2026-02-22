import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { AppColors } from '../theme';

interface ModelLoaderWidgetProps {
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  isDownloading: boolean;
  isLoading: boolean;
  progress: number;
  onLoad: () => void;
}

export const ModelLoaderWidget: React.FC<ModelLoaderWidgetProps> = ({
  title,
  subtitle,
  accentColor,
  isDownloading,
  isLoading,
  progress,
  onLoad,
}) => {
  const getIconEmoji = () => {
    if (title.includes('STT')) return '🎤';
    if (title.includes('TTS')) return '🔊';
    if (title.includes('Voice')) return '✨';
    return '📦';
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: accentColor + '20' }]}>
          <Text style={styles.iconEmoji}>{getIconEmoji()}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {(isDownloading || isLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={styles.loadingText}>
              {isDownloading
                ? `📦 Unpacking Asset... ${Math.round(progress)}%`
                : 'Loading model...'}
            </Text>
            {isDownloading && (
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${progress}%`,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}

        {!isDownloading && !isLoading && (
          <TouchableOpacity
            onPress={onLoad}
            activeOpacity={0.8}
            style={[styles.button, { backgroundColor: accentColor }]}
          >
            <Text style={styles.buttonText}>Unpack Local Model</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            🔒 All processing happens on your device. Your data never leaves your phone.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconEmoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  progressBarContainer: {
    width: 200,
    height: 6,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  infoBox: {
    marginTop: 32,
    padding: 16,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '20',
  },
  infoText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
