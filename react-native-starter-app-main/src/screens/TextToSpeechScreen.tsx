import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  NativeModules,
  Animated,
  Platform,
  Easing,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Rect, Line, Circle, Polyline } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { RunAnywhere } from '@runanywhere/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget } from '../components';
import { QUOTES } from '../data/quotes';

const { NativeAudioModule } = NativeModules;

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const SpeakerIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M11 5L6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5z"
      fill={color}
    />
    <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const StopIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="5" width="14" height="14" rx="3" fill={color} />
  </Svg>
);

const PlusIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

const PinIcon: React.FC<{ size?: number; color?: string; filled?: boolean }> = ({ size = 14, color = '#fff', filled = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2a5 5 0 0 1 5 5c0 3.5-5 10-5 10S7 10.5 7 7a5 5 0 0 1 5-5z"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="7" r="2" fill={filled ? '#fff' : color} opacity={filled ? 0.9 : 1} />
  </Svg>
);

const RefreshIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M1 4v6h6"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    />
    <Path
      d="M3.51 15a9 9 0 1 0 .49-4.5L1 10"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

// ─── Animated Waveform ────────────────────────────────────────────────────────
const WaveformBars: React.FC<{ isActive: boolean; color: string }> = ({ isActive, color }) => {
  const bars = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isActive) {
      const animations = bars.map((bar, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 80),
            Animated.timing(bar, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(bar, { toValue: 0.25, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        )
      );
      animations.forEach(a => a.start());
      return () => animations.forEach(a => a.stop());
    } else {
      bars.forEach(bar => Animated.spring(bar, { toValue: 0.3, useNativeDriver: true }).start());
    }
  }, [isActive]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 28 }}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{ width: 3, height: 28, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: bar }] }}
        />
      ))}
    </View>
  );
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
const SpinnerIcon: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth={2.5} strokeOpacity={0.2} />
        <Path d="M12 3a9 9 0 0 1 9 9" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
};

// ─── Data ─────────────────────────────────────────────────────────────────────
type QuoteSample = { label: string; text: string };

const ALL_SAMPLES: QuoteSample[] = QUOTES.map((quote) => {
  const parts = quote.split(' - ');
  const text = parts[0];
  const label = parts.length > 1 ? parts[1] : 'Quote';
  return { label, text };
});

const RATES = [0.5, 0.75, 1.0, 1.5, 2.0];

// shuffle helper
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

// ─── Screen ───────────────────────────────────────────────────────────────────
export const TextToSpeechScreen: React.FC = () => {
  const navigation = useNavigation();
  const modelService = useModelService();
  const [text, setText] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.75);
  const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);
  const [pinnedIndices, setPinnedIndices] = useState<number[]>([]);
  const [samples, setSamples] = useState(() => shuffle(ALL_SAMPLES).slice(0, 3));
  const [isReady, setIsReady] = useState(false);

  // Refs
  const cardAnim = useRef(new Animated.Value(0)).current;
  const rateAnim = useRef(new Animated.Value(0)).current;
  const samplesAnim = useRef(new Animated.Value(0)).current;
  const speakerPulse = useRef(new Animated.Value(1)).current;

  // Sync nav header to dark background
  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: '#050810', elevation: 0, shadowOpacity: 0, borderBottomWidth: 0 },
      headerTintColor: '#ffffff',
      headerTitle: 'Text to speech',
      headerTitleAlign: 'left',
      headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      headerBackTitleVisible: false,
    });
  }, [navigation]);

  // Entry animations
  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(cardAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
      Animated.spring(rateAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
      Animated.spring(samplesAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [isReady]); // Wait for AsyncStorage to load before animating

  // Load pinned quote from AsyncStorage
  useEffect(() => {
    const loadPinnedQuote = async () => {
      try {
        const storedQuoteText = await AsyncStorage.getItem('@pinned_quote_text');

        let initialSamples = shuffle(ALL_SAMPLES).slice(0, 3);

        if (storedQuoteText) {
          const pinnedQuote = ALL_SAMPLES.find((q: QuoteSample) => q.text === storedQuoteText);
          if (pinnedQuote) {
            // Remove the pinned quote if it randomly appeared in our initial 3
            initialSamples = initialSamples.filter((q: QuoteSample) => q.text !== storedQuoteText);
            // Put the pinned quote at the very top, and grab 2 more random ones
            initialSamples = [pinnedQuote, ...initialSamples.slice(0, 2)];
            // We know the pinned quote is now at index 0
            setPinnedIndices([0]);
          }
        }

        setSamples(initialSamples);
      } catch (e) {
        console.error('Failed to load pinned quote', e);
      } finally {
        setIsReady(true);
      }
    };

    loadPinnedQuote();
  }, []);

  // Speaker button pulses while playing
  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(speakerPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(speakerPulse, { toValue: 0.92, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      speakerPulse.stopAnimation();
      Animated.spring(speakerPulse, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [isPlaying]);

  useFocusEffect(
    useCallback(() => {
      // Focus gained
      return () => {
        // Focus lost - clean up immediately
        if (NativeAudioModule && isPlaying) {
          NativeAudioModule.stopPlayback().catch(() => { });
          setIsPlaying(false);
        }
      };
    }, [isPlaying])
  );

  const synthesizeAndPlay = async () => {
    if (!text.trim()) return;
    setIsSynthesizing(true);
    try {
      const result = await RunAnywhere.synthesize(text, {
        voice: 'default', rate: speechRate, pitch: 1.0, volume: 1.0,
      });
      const tempPath = await RunAnywhere.Audio.createWavFromPCMFloat32(result.audio, result.sampleRate || 22050);
      setCurrentAudioPath(tempPath);
      setIsSynthesizing(false);
      setIsPlaying(true);
      if (NativeAudioModule) {
        try {
          await NativeAudioModule.playAudio(tempPath);
          setTimeout(() => {
            setIsPlaying(false);
            setCurrentAudioPath(null);
            RNFS.unlink(tempPath).catch(() => { });
          }, (result.duration + 0.5) * 1000);
        } catch { setIsPlaying(false); }
      } else { setIsPlaying(false); }
    } catch {
      setIsSynthesizing(false);
      setIsPlaying(false);
    }
  };

  const stopPlayback = async () => {
    if (NativeAudioModule) { try { await NativeAudioModule.stopPlayback(); } catch { } }
    setIsPlaying(false);
    if (currentAudioPath) { RNFS.unlink(currentAudioPath).catch(() => { }); setCurrentAudioPath(null); }
  };

  const handleRefreshSamples = () => {
    const pinned = samples.filter((_, i) => pinnedIndices.includes(i));
    const usedTexts = new Set(pinned.map((s: QuoteSample) => s.text));
    const pool = ALL_SAMPLES.filter((s: QuoteSample) => !usedTexts.has(s.text));
    const fresh = shuffle(pool).slice(0, 3 - pinned.length);
    const next: typeof samples = [];
    let freshIdx = 0;
    for (let i = 0; i < 3; i++) {
      if (pinnedIndices.includes(i)) {
        next.push(samples[i]);
      } else {
        next.push(fresh[freshIdx++] ?? samples[i]);
      }
    }
    setSamples(next);
  };

  const togglePin = async (i: number) => {
    const isCurrentlyPinned = pinnedIndices.includes(i);
    const newPinnedIndices = isCurrentlyPinned
      ? pinnedIndices.filter(p => p !== i)
      : [...pinnedIndices, i];

    setPinnedIndices(newPinnedIndices);

    try {
      if (newPinnedIndices.length > 0) {
        // Save the actual text of the first pinned item to AsyncStorage
        const pinnedQuoteText = samples[newPinnedIndices[0]].text;
        await AsyncStorage.setItem('@pinned_quote_text', pinnedQuoteText);
      } else {
        await AsyncStorage.removeItem('@pinned_quote_text');
      }
    } catch (e) {
      console.error('Failed to save pinned quote', e);
    }
  };

  const canSpeak = text.trim().length > 0;
  const isBusy = isSynthesizing || isPlaying;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estSecs = wordCount > 0 ? Math.round(wordCount / (speechRate * 2.5)) : 0;

  if (!modelService.isTTSLoaded) {
    return (
      <ModelLoaderWidget
        title="TTS Voice Required"
        subtitle="Download and load the voice synthesis model"
        icon="volume"
        accentColor={AppColors.accentCyan}
        isDownloading={modelService.isTTSDownloading}
        isLoading={modelService.isTTSLoading}
        progress={modelService.ttsDownloadProgress}
        onLoad={modelService.downloadAndLoadTTS}
      />
    );
  }

  if (!isReady) return null;

  return (
    <View style={s.container}>
      {/* Full-screen background — sits behind everything */}
      <StatusBar
        translucent
        backgroundColor="#050810"
        barStyle="light-content"
      />
      <LinearGradient
        colors={['#050810', '#0A0F2E', '#0D0118']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={s.ambientGlow} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── INPUT CARD ──────────────────────────────────────────────────── */}
        <Animated.View style={{
          opacity: cardAnim,
          transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          marginBottom: 14,
        }}>
          <View style={[s.card, isBusy && s.cardActive]}>

            {/* Card header: "Your Text" label + hint + speaker button */}
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>Your Text</Text>
                <Text style={s.cardHint}>
                  {canSpeak
                    ? `${wordCount} words · ~${estSecs}s at ${speechRate}×`
                    : 'Type or pick a sample below'}
                </Text>
              </View>

              {/* Clear button (only when has text) */}
              {canSpeak && !isBusy && (
                <TouchableOpacity onPress={() => setText('')} style={s.clearBtn} activeOpacity={0.7}>
                  <Text style={s.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}

              {/* ── SPEAKER BUTTON — right corner of card header ── */}
              <Animated.View style={{ transform: [{ scale: speakerPulse }], marginLeft: 10 }}>
                <TouchableOpacity
                  onPress={isPlaying ? stopPlayback : synthesizeAndPlay}
                  disabled={isSynthesizing || !canSpeak}
                  activeOpacity={0.8}
                  style={[s.speakerBtn, isBusy && s.speakerBtnActive, !canSpeak && s.speakerBtnDisabled]}
                >
                  <LinearGradient
                    colors={
                      !canSpeak ? ['#2a2a3a', '#1e1e2e'] :
                        isSynthesizing ? ['#666', '#444'] :
                          isPlaying ? ['#FF416C', '#CC2255'] :
                            [AppColors.accentCyan, '#0891B2']
                    }
                    style={s.speakerBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {isSynthesizing
                      ? <SpinnerIcon size={22} />
                      : isPlaying
                        ? <StopIcon size={22} color="#fff" />
                        : <SpeakerIcon size={26} color={canSpeak ? '#fff' : 'rgba(255,255,255,0.25)'} />
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Text input */}
            <TextInput
              style={s.input}
              placeholder="What would you like me to say?"
              placeholderTextColor="rgba(255,255,255,0.18)"
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              selectionColor={AppColors.accentCyan}
            />

            {/* Footer waveform strip */}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)']}
              style={s.cardFooter}
            >
              <View style={s.statusRow}>
                <WaveformBars isActive={isPlaying} color={AppColors.accentCyan} />
                <Text style={s.statusText}>
                  {isSynthesizing ? 'Synthesizing...'
                    : isPlaying ? 'Speaking...'
                      : canSpeak ? 'Ready to speak'
                        : 'Waiting for input'}
                </Text>
              </View>
              {text.length > 0 && (
                <View style={s.charPill}>
                  <Text style={s.charPillText}>{text.length}</Text>
                </View>
              )}
            </LinearGradient>
          </View>
        </Animated.View>

        {/* ── SPEECH RATE ─────────────────────────────────────────────────── */}
        <Animated.View style={{
          opacity: rateAnim,
          transform: [{ translateY: rateAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          marginBottom: 28,
        }}>
          <View style={s.rateCard}>
            <View style={s.rateLabelRow}>
              <Text style={s.rateTitle}>Speed</Text>
              <View style={s.rateBadge}>
                <Text style={s.rateBadgeText}>{speechRate}×</Text>
              </View>
            </View>
            <View style={s.rateTrack}>
              {RATES.map((rate) => {
                const active = speechRate === rate;
                return (
                  <TouchableOpacity
                    key={rate}
                    onPress={() => setSpeechRate(rate)}
                    activeOpacity={0.75}
                    style={[s.rateChip, active && s.rateChipActive]}
                  >
                    {active && (
                      <LinearGradient
                        colors={[AppColors.accentCyan, '#0891B2']}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    )}
                    <Text style={[s.rateChipText, active && s.rateChipTextActive]}>{rate}×</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* ── SAMPLE TEXTS ────────────────────────────────────────────────── */}
        <Animated.View style={{
          opacity: samplesAnim,
          transform: [{ translateY: samplesAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}>
          {/* Section header with refresh button */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Try a sample</Text>
            <TouchableOpacity
              onPress={handleRefreshSamples}
              activeOpacity={0.7}
              style={s.refreshBtn}
            >
              <RefreshIcon size={15} color={CYAN} />
            </TouchableOpacity>
          </View>

          <View style={s.samplesGrid}>
            {samples.map((sample, i) => {
              const selected = text === sample.text;
              const pinned = pinnedIndices.includes(i);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setText(sample.text)}
                  activeOpacity={0.75}
                  style={[s.sampleCard, selected && s.sampleCardSelected]}
                >
                  <View style={s.sampleTop}>
                    <Text style={[s.sampleLabel, selected && s.sampleLabelSelected]}>
                      {sample.label}
                    </Text>

                    {/* Right-side action buttons: Pin + Plus */}
                    <View style={s.sampleActions}>
                      {/* Pin button */}
                      <TouchableOpacity
                        onPress={() => togglePin(i)}
                        activeOpacity={0.7}
                        style={[s.sampleActionBtn, pinned && s.sampleActionBtnPinned]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                      >
                        <PinIcon size={14} color={pinned ? '#fff' : CYAN} filled={pinned} />
                      </TouchableOpacity>

                      {/* Plus / Use button */}
                      <TouchableOpacity
                        onPress={() => setText(sample.text)}
                        activeOpacity={0.7}
                        style={[s.sampleActionBtn, selected && s.sampleActionBtnSelected]}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                      >
                        <PlusIcon size={14} color={selected ? '#fff' : CYAN} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={s.samplePreview} numberOfLines={2}>{sample.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const CYAN = '#00D4FF';
const CYAN_DIM = 'rgba(0,212,255,';

const s = StyleSheet.create({
  container: { flex: 1 },

  ambientGlow: {
    display: 'none',
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 32,
  },

  // ── Input card ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CYAN_DIM + '0.18)',
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: CYAN_DIM + '0.45)',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 8,
  },
  cardLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  cardHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: CYAN_DIM + '0.1)',
    borderWidth: 1,
    borderColor: CYAN_DIM + '0.25)',
  },
  clearBtnText: { fontSize: 12, color: CYAN, fontWeight: '600' },

  // Speaker button embedded in card header
  speakerBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  speakerBtnActive: {
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },
  speakerBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  speakerBtnGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },

  input: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    fontSize: 18,
    color: '#fff',
    minHeight: 140,
    lineHeight: 28,
    letterSpacing: 0.1,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.38)', letterSpacing: 0.3 },
  charPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  charPillText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },

  // ── Rate card ────────────────────────────────────────────────────────────────
  rateCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 18,
  },
  rateLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.2,
  },
  rateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: CYAN_DIM + '0.14)',
    borderWidth: 1,
    borderColor: CYAN_DIM + '0.3)',
  },
  rateBadgeText: { fontSize: 12, fontWeight: '700', color: CYAN },
  rateTrack: { flexDirection: 'row', gap: 8 },
  rateChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  rateChipActive: {
    borderColor: 'transparent',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  rateChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  rateChipTextActive: { color: '#fff', fontWeight: '800' },

  // ── Sample texts ─────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.28)',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CYAN_DIM + '0.1)',
    borderWidth: 1,
    borderColor: CYAN_DIM + '0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  samplesGrid: { gap: 10 },
  sampleCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
  },
  sampleCardSelected: {
    backgroundColor: CYAN_DIM + '0.07)',
    borderColor: CYAN_DIM + '0.35)',
  },
  sampleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sampleLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: CYAN,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    opacity: 0.6,
    flex: 1,
  },
  sampleLabelSelected: { opacity: 1 },
  samplePreview: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 24,
  },

  // Pin + Plus action buttons side by side
  sampleActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  sampleActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: CYAN_DIM + '0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sampleActionBtnPinned: {
    backgroundColor: CYAN,
    borderColor: 'transparent',
  },
  sampleActionBtnSelected: {
    backgroundColor: CYAN,
    borderColor: 'transparent',
  },
});
