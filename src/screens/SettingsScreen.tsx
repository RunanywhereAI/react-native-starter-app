import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Switch, StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppColors } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { LocalStorageService } from '../services/LocalStorageService';
import { AppSettings, NegotiationMode } from '../types/session';
import { getModeConfig } from '../ai/patternLibrary';

type SettingsScreenProps = { navigation: StackNavigationProp<RootStackParamList, 'Settings'> };

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ keys: number; estimatedSize: string } | null>(null);

  useEffect(() => { loadSettings(); loadStorageInfo(); }, []);
  const loadSettings = async () => { setSettings(await LocalStorageService.getSettings()); };
  const loadStorageInfo = async () => { setStorageInfo(await LocalStorageService.getStorageInfo()); };
  const saveSettings = async (s: AppSettings) => { await LocalStorageService.saveSettings(s); setSettings(s); };

  const handleClearData = () => {
    Alert.alert('Clear All Data', 'Delete all sessions? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete All', style: 'destructive', onPress: async () => { await LocalStorageService.clearAllData(); await loadStorageInfo(); Alert.alert('Success', 'All data cleared'); } },
    ]);
  };

  if (!settings) return <View style={[styles.container, styles.centered]}><Text style={styles.loadingText}>Loading...</Text></View>;
  const modeConfig = getModeConfig(settings.defaultMode);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.primaryLight} />
      <LinearGradient colors={['#F5F0FF', '#EDE5FF']} style={styles.gradient}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Customize your Latent experience</Text>
          </View>

          {/* Mode Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Default Mode</Text>
            <TouchableOpacity style={styles.modeButton} onPress={() => {
              Alert.alert('Select Default Mode', 'Choose your default mode',
                [NegotiationMode.JOB_INTERVIEW, NegotiationMode.SALES, NegotiationMode.STARTUP_PITCH, NegotiationMode.SALARY_RAISE]
                  .map((m) => ({ text: getModeConfig(m).displayName, onPress: () => saveSettings({ ...settings, defaultMode: m }) }))
              );
            }}>
              <View style={styles.modeIconCircle}><Text style={styles.modeIcon}>{modeConfig.icon}</Text></View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>{modeConfig.displayName}</Text>
                <Text style={styles.modeDesc}>{modeConfig.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Pattern Detection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pattern Detection</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Sensitivity</Text>
                <Text style={styles.settingDesc}>
                  {settings.patternSensitivity < 0.8 ? 'Low - Fewer false positives' : settings.patternSensitivity <= 1.2 ? 'Normal - Balanced' : 'High - More patterns'}
                </Text>
              </View>
              <View style={styles.sensitivityBtns}>
                {[{ label: 'Low', val: 0.7, check: settings.patternSensitivity <= 0.7 },
                { label: 'Normal', val: 1.0, check: settings.patternSensitivity === 1.0 },
                { label: 'High', val: 1.3, check: settings.patternSensitivity >= 1.3 }].map((b) => (
                  <TouchableOpacity key={b.label} style={[styles.sensBtn, b.check && styles.sensBtnActive]}
                    onPress={() => saveSettings({ ...settings, patternSensitivity: b.val })}>
                    <Text style={[styles.sensBtnText, b.check && styles.sensBtnTextActive]}>{b.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Session Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Settings</Text>
            {[
              { label: 'Auto-Save', desc: 'Saves session every 45 seconds', key: 'enableAutoSave' as const },
              { label: 'Haptic Feedback', desc: 'Vibrate on pattern detection', key: 'enableHapticFeedback' as const },
              { label: 'Suggestion Notifications', desc: 'Show notifications', key: 'enableSuggestionNotifications' as const },
            ].map((s) => (
              <View key={s.key} style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{s.label}</Text>
                  <Text style={styles.settingDesc}>{s.desc}</Text>
                </View>
                <Switch value={settings[s.key]} onValueChange={(v) => saveSettings({ ...settings, [s.key]: v })}
                  trackColor={{ false: '#E5E7EB', true: '#C4B5FD' }} thumbColor={settings[s.key] ? '#7B61FF' : '#D1D5DB'} />
              </View>
            ))}
          </View>

          {/* Debug */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🐛 Debug & Testing</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Debug Mode</Text>
                <Text style={styles.settingDesc}>Use test transcripts</Text>
              </View>
              <Switch value={settings.debugMode || false} onValueChange={(v) => {
                saveSettings({ ...settings, debugMode: v });
                if (v) Alert.alert('Debug Mode Enabled', 'Hardcoded transcripts will be used. Restart your session.', [{ text: 'Got it' }]);
              }} trackColor={{ false: '#E5E7EB', true: '#FDE68A' }} thumbColor={settings.debugMode ? '#F59E0B' : '#D1D5DB'} />
            </View>
            {settings.debugMode && (
              <View style={styles.debugNotice}><Text style={styles.debugNoticeText}>⚠️ Debug mode active. Test transcripts injected every 7s.</Text></View>
            )}
          </View>

          {/* Storage */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage</Text>
            {storageInfo && (
              <View style={styles.storageCard}>
                <View style={styles.storageRow}><Text style={styles.storageLabel}>Sessions</Text><Text style={styles.storageValue}>{storageInfo.keys}</Text></View>
                <View style={styles.storageDivider} />
                <View style={styles.storageRow}><Text style={styles.storageLabel}>Used</Text><Text style={styles.storageValue}>{storageInfo.estimatedSize}</Text></View>
              </View>
            )}
            <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
              <Text style={styles.dangerButtonText}>Clear All Data</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy */}
          <View style={styles.privacyCard}>
            <View style={styles.privacyIconCircle}><Text style={styles.privacyIcon}>🔒</Text></View>
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle}>100% Private & Offline</Text>
              <Text style={styles.privacyDesc}>All data stays on your device. No cloud.</Text>
            </View>
          </View>

          {/* About */}
          <View style={styles.aboutSection}>
            <LinearGradient colors={['#7B61FF', '#9B82FF']} style={styles.aboutLogo}>
              <Text style={styles.aboutLogoText}>L</Text>
            </LinearGradient>
            <Text style={styles.aboutTitle}>Latent</Text>
            <Text style={styles.aboutSubtitle}>Offline Meeting Intelligence</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.primaryLight },
  gradient: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: AppColors.textSecondary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 56, paddingBottom: 40 },

  header: { marginBottom: 28 },
  title: { fontSize: 32, fontWeight: '700', color: AppColors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: AppColors.textSecondary },

  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: AppColors.textPrimary, marginBottom: 14 },

  modeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  modeIconCircle: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  modeIcon: { fontSize: 24 },
  modeInfo: { flex: 1 },
  modeName: { fontSize: 16, fontWeight: '600', color: AppColors.textPrimary, marginBottom: 3 },
  modeDesc: { fontSize: 13, color: AppColors.textSecondary, lineHeight: 17 },
  chevron: { fontSize: 24, color: AppColors.textMuted },

  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: AppColors.textPrimary, marginBottom: 3 },
  settingDesc: { fontSize: 12, color: AppColors.textSecondary, lineHeight: 16 },

  sensitivityBtns: { flexDirection: 'row', gap: 6 },
  sensBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F3F4F6' },
  sensBtnActive: { backgroundColor: '#7B61FF' },
  sensBtnText: { fontSize: 12, fontWeight: '600', color: AppColors.textSecondary },
  sensBtnTextActive: { color: '#FFFFFF' },

  storageCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, marginBottom: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  storageRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  storageDivider: { height: 1, backgroundColor: '#F3F4F6' },
  storageLabel: { fontSize: 14, color: AppColors.textSecondary },
  storageValue: { fontSize: 14, fontWeight: '600', color: AppColors.textPrimary },

  dangerButton: { backgroundColor: '#FEE2E2', padding: 16, borderRadius: 16, alignItems: 'center' },
  dangerButtonText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },

  debugNotice: { backgroundColor: '#FEF3C7', padding: 14, borderRadius: 14, marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  debugNoticeText: { fontSize: 12, color: '#92400E', lineHeight: 16 },

  privacyCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, marginBottom: 28, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
  privacyIconCircle: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  privacyIcon: { fontSize: 22 },
  privacyText: { flex: 1 },
  privacyTitle: { fontSize: 15, fontWeight: '600', color: AppColors.textPrimary, marginBottom: 3 },
  privacyDesc: { fontSize: 12, color: AppColors.textSecondary, lineHeight: 17 },

  aboutSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
  aboutLogo: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12, elevation: 4, shadowColor: '#7B61FF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
  aboutLogoText: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  aboutTitle: { fontSize: 22, fontWeight: '700', color: AppColors.textPrimary, marginBottom: 4 },
  aboutSubtitle: { fontSize: 14, color: '#7B61FF', marginBottom: 8 },
  aboutVersion: { fontSize: 12, color: AppColors.textMuted },
});
