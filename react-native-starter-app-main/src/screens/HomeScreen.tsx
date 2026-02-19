import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppColors } from '../theme';
import { FeatureCard } from '../components';
import { RootStackParamList } from '../navigation/types';

type HomeScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[AppColors.primaryDark, '#0F1629', AppColors.primaryMid]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[AppColors.accentCyan, AppColors.accentViolet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Text style={styles.logoIcon}>⚡</Text>
              </LinearGradient>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>RunAnywhere</Text>
              <Text style={styles.subtitle}>React Native SDK Starter</Text>
            </View>
          </View>

          {/* Privacy Banner */}
          <View style={styles.privacyBanner}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle}>Privacy-First On-Device AI</Text>
              <Text style={styles.privacySubtitle}>
                All AI processing happens locally on your device. No data ever leaves your phone.
              </Text>
            </View>
          </View>

          {/* Feature Cards Grid */}
          <View style={styles.gridContainer}>
            <View style={styles.row}>
              <FeatureCard
                title="Chat"
                subtitle="LLM Text Generation"
                icon="chat"
                gradientColors={[AppColors.accentCyan, '#0EA5E9']}
                onPress={() => navigation.navigate('Chat')}
              />
              <FeatureCard
                title="Tools"
                subtitle="Tool Calling"
                icon="tools"
                gradientColors={[AppColors.accentOrange, '#E67E22']}
                onPress={() => navigation.navigate('ToolCalling')}
              />
            </View>
            <View style={styles.row}>
              <FeatureCard
                title="Speech"
                subtitle="Speech to Text"
                icon="mic"
                gradientColors={[AppColors.accentViolet, '#7C3AED']}
                onPress={() => navigation.navigate('SpeechToText')}
              />
              <FeatureCard
                title="Voice"
                subtitle="Text to Speech"
                icon="volume"
                gradientColors={[AppColors.accentPink, '#DB2777']}
                onPress={() => navigation.navigate('TextToSpeech')}
              />
            </View>
            <View style={styles.row}>
              <FeatureCard
                title="Pipeline"
                subtitle="Voice Agent"
                icon="pipeline"
                gradientColors={[AppColors.accentGreen, '#059669']}
                onPress={() => navigation.navigate('VoicePipeline')}
              />
              <View style={{ flex: 1, margin: 8 }} />
            </View>
          </View>

          {/* Model Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🤖</Text>
              <Text style={styles.infoLabel}>LLM</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.infoValue}>SmolLM2 360M</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🎤</Text>
              <Text style={styles.infoLabel}>STT</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.infoValue}>Whisper Tiny</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🔊</Text>
              <Text style={styles.infoLabel}>TTS</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.infoValue}>Piper TTS</Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primaryDark,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginRight: 16,
  },
  logoGradient: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: AppColors.accentCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  logoIcon: {
    fontSize: 32,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.accentCyan,
    marginTop: 2,
  },
  privacyBanner: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: AppColors.surfaceCard + 'CC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.accentCyan + '33',
    marginBottom: 32,
  },
  privacyIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textPrimary,
    marginBottom: 4,
  },
  privacySubtitle: {
    fontSize: 12,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
  gridContainer: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 0,
  },
  infoSection: {
    padding: 20,
    backgroundColor: AppColors.surfaceCard + '80',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  infoValue: {
    fontSize: 12,
    color: AppColors.accentCyan,
    fontWeight: '500',
  },
});
