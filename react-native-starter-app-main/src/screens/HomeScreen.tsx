import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { FeatureCard } from '../components';
import { RootStackParamList } from '../navigation/types';
import { usePinpointer } from '../hooks/usePinpointer';

type HomeScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
  onCloseDrawer?: () => void;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, onCloseDrawer }) => {
  const {
    isSyncing,
    isSyncingDocs,
    handleDeepSync,
    handleDocumentSync,
    syncCount,
    totalImages,
    docSyncCount,
    totalDocs,
  } = usePinpointer();

  // --- Loading UI Animations ---
  const syncProgress = useRef(new Animated.Value(0)).current;
  const syncSpinAnim = useRef(new Animated.Value(0)).current;
  const syncFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing || isSyncingDocs) {
      Animated.timing(syncFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      Animated.loop(
        Animated.timing(syncSpinAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      syncSpinAnim.stopAnimation();
      syncFadeAnim.setValue(0);
      syncSpinAnim.setValue(0);
    }
  }, [isSyncing, isSyncingDocs, syncFadeAnim, syncSpinAnim]);

  useEffect(() => {
    let targetProgress = 0;
    if (isSyncing) {
      // Fallback to 300 (total cache size) if totalImages is zero to prevent NaN
      const baseTotal = totalImages > 0 ? totalImages : 300;
      targetProgress = Math.min(syncCount / baseTotal, 1);
    } else if (isSyncingDocs && totalDocs > 0) {
      targetProgress = Math.min(docSyncCount / totalDocs, 1);
    }

    Animated.timing(syncProgress, {
      toValue: targetProgress,
      duration: 300, // Smooth 300ms catchup
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [syncCount, docSyncCount, totalImages, totalDocs, isSyncing, isSyncingDocs, syncProgress]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#05050A" />
      <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
        <View style={{ position: 'absolute', top: -100, left: -150, width: 800, height: 250, backgroundColor: 'rgba(99, 102, 241, 0.1)', transform: [{ rotate: '45deg' }], borderRadius: 400 }} />
        <View style={{ position: 'absolute', bottom: -50, right: -250, width: 900, height: 300, backgroundColor: 'rgba(168, 85, 247, 0.1)', transform: [{ rotate: '-35deg' }], borderRadius: 450 }} />
      </View>
      <View style={styles.mainContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.quoteText}>INDEXED. OFFLINE. YOURS.</Text>
        </View>

        <View style={styles.gridContainer}>
          {/* Top Bento Row */}
          <View style={{ flexDirection: 'row', height: 240 }}>
            {/* Left Column (Stacked) */}
            <View style={{ flex: 1, marginRight: 8, justifyContent: 'space-between' }}>
              <FeatureCard
                title="Scan Images"
                subtitle="Image to Text"
                icon="⛶"
                style={{ flex: 1, marginBottom: 8 }}
                onPress={() => { if (onCloseDrawer) onCloseDrawer(); navigation.navigate('SmartClipboard'); }}
              />
              <FeatureCard
                title="Read Aloud"
                subtitle="Text to Speech"
                icon="☊"
                iconSize={32}
                iconStyle={{ includeFontPadding: false, transform: [{ translateY: -3 }] }}
                style={{ flex: 1, marginTop: 8 }}
                onPress={() => { if (onCloseDrawer) onCloseDrawer(); navigation.navigate('TextToSpeech'); }}
              />
            </View>
            {/* Right Column (Tall) */}
            <View style={{ flex: 1, marginLeft: 8 }}>
              <FeatureCard
                title="Gallery"
                subtitle="Recent Media"
                icon="◷"
                iconSize={38}
                iconStyle={{ includeFontPadding: false, transform: [{ translateY: -3 }] }}
                style={{ flex: 1 }}
                onPress={() => { if (onCloseDrawer) onCloseDrawer(); navigation.navigate('Gallery' as any); }}
              />
            </View>
          </View>

          {/* EXACTLY ONE DIVIDER LINE */}
          <View style={{ height: 1, backgroundColor: 'rgba(139, 92, 246, 0.3)', width: '100%', marginVertical: 24 }} />

          {/* PERFECTLY SIZED SYNC CARD (140px Height) */}
          {(isSyncing || isSyncingDocs) ? (
            <Animated.View style={[{ width: '100%', opacity: syncFadeAnim }]}>
              <View style={styles.loadingBoxContainer}>
                <LinearGradient
                  colors={['rgba(0, 217, 255, 0.12)', 'rgba(0, 217, 255, 0.03)']}
                  style={styles.loadingBox}
                >
                  <View style={styles.loadingHeaderRow}>
                    <View style={styles.loadingLoaderContainer}>
                      <Animated.View style={[styles.loadingSpinner, { transform: [{ rotate: syncSpinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
                        <LinearGradient colors={['#00D9FF', 'transparent']} style={StyleSheet.absoluteFill} />
                      </Animated.View>
                      <View style={styles.loadingSpinnerCenterMask} />
                    </View>

                    <View style={styles.loadingShieldBadge}>
                      <Text style={styles.loadingShieldEmoji}>🛡️</Text>
                      <View style={styles.loadingLiveDot} />
                    </View>
                  </View>

                  <Text style={styles.loadingSubtitle}>
                    {isSyncing ? `Analyzing images on-device...` : `Analyzing docs on-device...`}
                  </Text>

                  <View style={styles.loadingProgressTrack}>
                    <Animated.View style={[styles.loadingProgressBar, { width: syncProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
                      <LinearGradient
                        colors={['#00D9FF', '#00A3FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  </View>

                  <View style={styles.loadingFooterRow}>
                    <Text style={styles.loadingPrivacyText}>
                      100% private. No data leaves this device.
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            </Animated.View>
          ) : (
            <FeatureCard
              title="Universal Sync"
              subtitle="Index Entire Device"
              style={{
                width: '100%',
                height: 140,
                backgroundColor: 'rgba(109, 40, 217, 0.15)',
                borderWidth: 1,
                borderColor: 'rgba(139, 92, 246, 0.25)',
                borderRadius: 20,
              }}
              onPress={() => {
                // If closing drawer logic exists, call it immediately
                if (onCloseDrawer) onCloseDrawer();
                // Instead of navigating, trigger both syncing methods on the spot!
                handleDeepSync();
                handleDocumentSync();
              }}
            />
          )}
        </View>

        {/* Privacy Banner */}
        <View style={styles.privacyBanner}>
          <Text style={styles.privacyIcon}>◈</Text>
          <View style={styles.privacyText}>
            <Text style={styles.privacyTitle}>Privacy-First On-Device AI</Text>
            <Text style={styles.privacySubtitle}>
              All AI processing happens locally on your device. No data ever leaves your phone.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05050A',
  },
  mainContent: {
    flex: 1,
    padding: 24,
    paddingTop: 35,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 53,
  },
  logoCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 28,
    color: '#22D3EE',
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    letterSpacing: 3,
    marginLeft: 16,
    flexShrink: 1,
  },
  privacyBanner: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#0D1424',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    marginTop: 12,
  },
  privacyIcon: {
    fontSize: 28,
    marginRight: 16,
    color: '#94A3B8',
  },
  privacyText: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  privacySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  gridContainer: {
    flex: 1,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 0,
  },
  loadingBoxContainer: {
    height: 140,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.2)',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    elevation: 8,
  },
  loadingBox: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  loadingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  loadingLoaderContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadingSpinnerCenterMask: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0F172A',
  },
  loadingShieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.1)',
  },
  loadingShieldEmoji: {
    fontSize: 12,
    marginRight: 6,
  },
  loadingLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D9FF',
  },
  loadingSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  loadingProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  loadingProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  loadingFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingPrivacyText: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
});
