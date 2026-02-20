import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Image,
    Animated,
    ActivityIndicator,
    Vibration,
    NativeModules,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { RunAnywhere } from '@runanywhere/core';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget } from '../components';
import { analyzeImage } from '../utils/VisionPipeline';

// Native Audio Module — same as TextToSpeechScreen
const { NativeAudioModule } = NativeModules;

// ─── Status Types ────────────────────────────────────────────────────────────
type ScreenPhase =
    | 'idle'        // waiting for user to take photo
    | 'scanning'    // OCR in progress
    | 'speaking'    // TTS playing
    | 'done'        // finished speaking, showing text
    | 'no-text';    // no text detected

// ─── Screen ──────────────────────────────────────────────────────────────────

export const PointAndSpeakScreen: React.FC = () => {
    const modelService = useModelService();

    // State
    const [phase, setPhase] = useState<ScreenPhase>('idle');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [detectedText, setDetectedText] = useState('');
    const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

    const activeRequestId = useRef<number>(0);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    // Track latest audio path for unmount cleanup
    const lastAudioPath = useRef<string | null>(null);
    useEffect(() => {
        lastAudioPath.current = currentAudioPath;
    }, [currentAudioPath]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (NativeAudioModule) {
                NativeAudioModule.stopPlayback().catch(() => { });
            }
            if (lastAudioPath.current) {
                RNFS.unlink(lastAudioPath.current).catch(() => { });
            }
        };
    }, []);

    // Pulse animation for the main button
    useEffect(() => {
        if (phase === 'idle') {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.08,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                ]),
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [phase, pulseAnim]);

    // Glow animation for speaking state
    useEffect(() => {
        if (phase === 'speaking') {
            const glow = Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.3,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ]),
            );
            glow.start();
            return () => glow.stop();
        }
    }, [phase, glowAnim]);

    // Wave animation for scanning
    useEffect(() => {
        if (phase === 'scanning') {
            const wave = Animated.loop(
                Animated.timing(waveAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            );
            wave.start();
            return () => wave.stop();
        }
    }, [phase, waveAnim]);

    // ─── Core Pipeline ───────────────────────────────────────────────────────

    const speakText = async (text: string) => {
        const reqId = Date.now();
        activeRequestId.current = reqId;

        setPhase('speaking');
        setIsGeneratingAudio(true);
        try {
            const result = await RunAnywhere.synthesize(text, {
                voice: 'default',
                rate: 0.9,  // slightly slower for accessibility
                pitch: 1.0,
                volume: 1.0,
            });

            if (activeRequestId.current !== reqId) return; // aborted

            const tempPath = await RunAnywhere.Audio.createWavFromPCMFloat32(
                result.audio,
                result.sampleRate || 22050,
            );

            if (activeRequestId.current !== reqId) {
                RNFS.unlink(tempPath).catch(() => { });
                return; // aborted
            }

            setCurrentAudioPath(tempPath);
            setIsGeneratingAudio(false);

            if (NativeAudioModule) {
                const playResult = await NativeAudioModule.playAudio(tempPath);

                if (activeRequestId.current !== reqId) {
                    NativeAudioModule.stopPlayback().catch(() => { });
                    RNFS.unlink(tempPath).catch(() => { });
                    return; // aborted
                }

                // Fallback duration if result.duration is undefined
                const durationSeconds = result.duration || playResult?.duration || 5;

                console.log(`[PointAndSpeak] Audio playing... duration: ${durationSeconds}s`);

                // Wait for playback to complete
                setTimeout(() => {
                    if (activeRequestId.current === reqId) {
                        setPhase((prev) => prev === 'speaking' ? 'done' : prev);
                        setCurrentAudioPath(null);
                        RNFS.unlink(tempPath).catch(() => { });
                    }
                }, (durationSeconds + 0.5) * 1000);
            } else {
                setPhase('done');
            }
        } catch (error) {
            console.error('[PointAndSpeak] TTS error:', error);
            if (activeRequestId.current === reqId) setPhase('done');
        } finally {
            if (activeRequestId.current === reqId) setIsGeneratingAudio(false);
        }
    };

    const scanAndSpeak = async (uri: string) => {
        setImageUri(uri);
        setPhase('scanning');
        setDetectedText('');

        try {
            const result = await analyzeImage(uri);

            if (result.detection_type === 'EMPTY' || !result.raw_text.trim()) {
                setPhase('no-text');
                Vibration.vibrate([0, 100, 50, 100]); // double buzz = no text
                return;
            }

            setDetectedText(result.raw_text);
            Vibration.vibrate(50); // single short buzz = success

            // Animate text in
            fadeAnim.setValue(0);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();

            console.log('[PointAndSpeak] Extracted raw text, length:', result.raw_text.length);

            // Auto-speak the raw text
            await speakText(result.raw_text);
        } catch (error) {
            console.error('[PointAndSpeak] Pipeline error:', error);
            setPhase('no-text');
            Vibration.vibrate([0, 100, 50, 100]);
        }
    };

    const handleCapture = async () => {
        try {
            const result = await launchCamera({
                mediaType: 'photo',
                quality: 1,
                saveToPhotos: false,
            });
            if (result.assets?.[0]?.uri) {
                scanAndSpeak(result.assets[0].uri);
            }
        } catch (err) {
            console.error('[PointAndSpeak] Camera error:', err);
        }
    };

    const handleGallery = async () => {
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                quality: 1,
            });
            if (result.assets?.[0]?.uri) {
                scanAndSpeak(result.assets[0].uri);
            }
        } catch (err) {
            console.error('[PointAndSpeak] Gallery error:', err);
        }
    };

    const handleReplay = () => {
        if (detectedText) {
            speakText(detectedText);
        }
    };

    const handleStop = async () => {
        activeRequestId.current = Date.now(); // invalidate any pending speech
        setIsGeneratingAudio(false);

        if (NativeAudioModule) {
            try {
                await NativeAudioModule.stopPlayback();
            } catch (_) { }
        }
        if (currentAudioPath) {
            RNFS.unlink(currentAudioPath).catch(() => { });
            setCurrentAudioPath(null);
        }
        setPhase((prev) => prev === 'speaking' ? 'done' : prev); // ONLY if speaking
    };

    const handleReset = async () => {
        await handleStop();
        setPhase('idle');
        setImageUri(null);
        setDetectedText('');
    };

    // ─── TTS Model Gate ──────────────────────────────────────────────────────

    if (!modelService.isTTSLoaded) {
        return (
            <ModelLoaderWidget
                title="Voice Model Required"
                subtitle="Download the text-to-speech model to enable Point & Speak"
                icon="volume"
                accentColor={AppColors.accentGreen}
                isDownloading={modelService.isTTSDownloading}
                isLoading={modelService.isTTSLoading}
                progress={modelService.ttsDownloadProgress}
                onLoad={modelService.downloadAndLoadTTS}
            />
        );
    }

    // ─── Render: Idle State ──────────────────────────────────────────────────

    const renderIdle = () => (
        <View style={styles.idleContainer}>
            {/* Logo area */}
            <View style={styles.logoArea}>
                <LinearGradient
                    colors={[AppColors.accentGreen + '20', AppColors.accentGreen + '05']}
                    style={styles.logoGlow}
                >
                    <Text style={styles.logoEmoji}>👁️‍🗨️</Text>
                </LinearGradient>
                <Text style={styles.logoTitle}>Point & Speak</Text>
                <Text style={styles.logoSubtitle}>
                    Point at any text — signs, labels, menus, books — and hear it read aloud instantly
                </Text>
            </View>

            {/* Big Capture Button */}
            <View style={styles.captureArea}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity onPress={handleCapture} activeOpacity={0.8}>
                        <LinearGradient
                            colors={[AppColors.accentGreen, '#059669']}
                            style={styles.captureButton}
                        >
                            <Text style={styles.captureIcon}>🎯</Text>
                            <Text style={styles.captureLabel}>Tap to Scan & Listen</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                    onPress={handleGallery}
                    style={styles.galleryLink}
                    activeOpacity={0.7}
                >
                    <Text style={styles.galleryLinkText}>📁 Or pick from gallery</Text>
                </TouchableOpacity>
            </View>

            {/* Info Cards */}
            <View style={styles.infoCards}>
                <View style={styles.infoCard}>
                    <Text style={styles.infoEmoji}>🔇</Text>
                    <Text style={styles.infoText}>Works 100% Offline</Text>
                </View>
                <View style={styles.infoCard}>
                    <Text style={styles.infoEmoji}>🌐</Text>
                    <Text style={styles.infoText}>Hindi + English</Text>
                </View>
                <View style={styles.infoCard}>
                    <Text style={styles.infoEmoji}>♿</Text>
                    <Text style={styles.infoText}>Accessibility First</Text>
                </View>
            </View>
        </View>
    );

    // ─── Render: Scanning State ──────────────────────────────────────────────

    const renderScanning = () => (
        <View style={styles.scanningContainer}>
            {imageUri && (
                <View style={styles.scanImageWrapper}>
                    <Image source={{ uri: imageUri }} style={styles.scanImage} resizeMode="cover" />
                    {/* Scanning overlay */}
                    <View style={styles.scanOverlay}>
                        <Animated.View
                            style={[
                                styles.scanLine,
                                {
                                    transform: [
                                        {
                                            translateY: waveAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [-100, 220],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                    </View>
                </View>
            )}
            <ActivityIndicator
                size="large"
                color={AppColors.accentGreen}
                style={{ marginTop: 24 }}
            />
            <Text style={styles.scanningText}>Reading text...</Text>
            <Text style={styles.scanningSubtext}>Running OCR (Hindi + English)</Text>
        </View>
    );

    // ─── Render: Speaking / Done State ───────────────────────────────────────

    const renderSpeaking = () => (
        <Animated.View style={[styles.speakingContainer, { opacity: fadeAnim }]}>
            {/* Image */}
            {imageUri && (
                <Image source={{ uri: imageUri }} style={styles.resultImage} resizeMode="cover" />
            )}

            {/* Detected Text Card */}
            <View style={[
                styles.textResultCard,
                phase === 'speaking' && styles.textResultCardActive,
            ]}>
                <View style={styles.textResultHeader}>
                    <Text style={styles.textResultTitle}>
                        {phase === 'speaking'
                            ? (isGeneratingAudio ? '⏳ Generating Audio...' : '🔊 Reading Aloud...')
                            : '✅ Finished'}
                    </Text>
                </View>

                {/* Sound Waves during speaking */}
                {phase === 'speaking' && !isGeneratingAudio && (
                    <View style={styles.soundWaves}>
                        {[...Array(9)].map((_, i) => (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.soundBar,
                                    {
                                        height: 12 + Math.random() * 28,
                                        opacity: glowAnim.interpolate({
                                            inputRange: [0.3, 1],
                                            outputRange: [0.4, 1],
                                        }),
                                    },
                                ]}
                            />
                        ))}
                    </View>
                )}

                {/* Loading indicator during generating */}
                {phase === 'speaking' && isGeneratingAudio && (
                    <View style={[styles.soundWaves, { paddingVertical: 10 }]}>
                        <ActivityIndicator size="small" color={AppColors.accentGreen} />
                    </View>
                )}

                <ScrollView style={styles.textResultScroll} nestedScrollEnabled>
                    <Text style={styles.textResultContent}>{detectedText}</Text>
                </ScrollView>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {phase === 'speaking' ? (
                    <TouchableOpacity onPress={handleStop} activeOpacity={0.8}>
                        <LinearGradient
                            colors={[AppColors.error, '#DC2626']}
                            style={styles.controlButton}
                        >
                            <Text style={styles.controlIcon}>⏹️</Text>
                            <Text style={styles.controlLabel}>Stop</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.controlRow}>
                        <TouchableOpacity onPress={handleReplay} activeOpacity={0.8} style={{ flex: 1 }}>
                            <LinearGradient
                                colors={[AppColors.accentGreen, '#059669']}
                                style={styles.controlButton}
                            >
                                <Text style={styles.controlIcon}>🔄</Text>
                                <Text style={styles.controlLabel}>Replay</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleReset}
                            activeOpacity={0.8}
                            style={[styles.controlButtonOutline, { flex: 1 }]}
                        >
                            <Text style={styles.controlIcon}>📸</Text>
                            <Text style={styles.controlLabelOutline}>New Scan</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Animated.View>
    );

    // ─── Render: No Text ─────────────────────────────────────────────────────

    const renderNoText = () => (
        <View style={styles.noTextContainer}>
            {imageUri && (
                <Image source={{ uri: imageUri }} style={styles.noTextImage} resizeMode="cover" />
            )}
            <View style={styles.noTextCard}>
                <Text style={styles.noTextEmoji}>🤷</Text>
                <Text style={styles.noTextTitle}>No Text Found</Text>
                <Text style={styles.noTextSubtitle}>
                    Could not detect readable text in this image. Try pointing at a clearer sign, label, or document.
                </Text>
            </View>
            <TouchableOpacity onPress={handleReset} activeOpacity={0.8}>
                <LinearGradient
                    colors={[AppColors.accentGreen, '#059669']}
                    style={styles.retryButton}
                >
                    <Text style={styles.retryIcon}>📸</Text>
                    <Text style={styles.retryLabel}>Try Again</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    // ─── Main Render ──────────────────────────────────────────────────────────

    const renderContent = () => {
        switch (phase) {
            case 'idle':
                return renderIdle();
            case 'scanning':
                return renderScanning();
            case 'speaking':
            case 'done':
                return renderSpeaking();
            case 'no-text':
                return renderNoText();
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {renderContent()}
            </ScrollView>
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.primaryDark,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },

    // ─── Idle ───────────────────────────────────────────────
    idleContainer: {
        flex: 1,
    },
    logoArea: {
        alignItems: 'center',
        paddingTop: 16,
        marginBottom: 40,
    },
    logoGlow: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    logoEmoji: {
        fontSize: 56,
    },
    logoTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: AppColors.textPrimary,
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    logoSubtitle: {
        fontSize: 15,
        color: AppColors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 16,
    },

    // ─── Capture ────────────────────────────────────────────
    captureArea: {
        alignItems: 'center',
        marginBottom: 40,
    },
    captureButton: {
        width: 200,
        height: 200,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 12,
        shadowColor: AppColors.accentGreen,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
    },
    captureIcon: {
        fontSize: 56,
        marginBottom: 8,
    },
    captureLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    galleryLink: {
        marginTop: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    galleryLinkText: {
        fontSize: 14,
        color: AppColors.textMuted,
        fontWeight: '500',
    },

    // ─── Info Cards ─────────────────────────────────────────
    infoCards: {
        flexDirection: 'row',
        gap: 10,
    },
    infoCard: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        backgroundColor: AppColors.surfaceCard,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: AppColors.textMuted + '1A',
    },
    infoEmoji: {
        fontSize: 24,
        marginBottom: 6,
    },
    infoText: {
        fontSize: 11,
        color: AppColors.textSecondary,
        textAlign: 'center',
        fontWeight: '500',
    },

    // ─── Scanning ───────────────────────────────────────────
    scanningContainer: {
        alignItems: 'center',
        paddingTop: 20,
    },
    scanImageWrapper: {
        width: 280,
        height: 280,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: AppColors.accentGreen + '60',
    },
    scanImage: {
        width: '100%',
        height: '100%',
    },
    scanOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: AppColors.primaryDark + '55',
        overflow: 'hidden',
    },
    scanLine: {
        width: '100%',
        height: 3,
        backgroundColor: AppColors.accentGreen,
        shadowColor: AppColors.accentGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 4,
    },
    scanningText: {
        fontSize: 20,
        fontWeight: '700',
        color: AppColors.textPrimary,
        marginTop: 24,
    },
    scanningSubtext: {
        fontSize: 13,
        color: AppColors.textMuted,
        marginTop: 6,
    },

    // ─── Speaking / Done ────────────────────────────────────
    speakingContainer: {
        flex: 1,
    },
    resultImage: {
        width: '100%',
        height: 180,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: AppColors.accentGreen + '30',
    },
    textResultCard: {
        backgroundColor: AppColors.surfaceCard,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: AppColors.textMuted + '30',
        overflow: 'hidden',
        marginBottom: 20,
    },
    textResultCardActive: {
        borderColor: AppColors.accentGreen + '80',
        borderWidth: 2,
        shadowColor: AppColors.accentGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 6,
    },
    textResultHeader: {
        padding: 16,
        paddingBottom: 0,
    },
    textResultTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: AppColors.accentGreen,
    },
    soundWaves: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        paddingHorizontal: 16,
        gap: 4,
    },
    soundBar: {
        width: 5,
        backgroundColor: AppColors.accentGreen,
        borderRadius: 3,
    },
    textResultScroll: {
        maxHeight: 200,
        padding: 16,
    },
    textResultContent: {
        fontSize: 16,
        color: AppColors.textPrimary,
        lineHeight: 26,
    },

    // ─── Controls ───────────────────────────────────────────
    controls: {
        marginTop: 4,
    },
    controlRow: {
        flexDirection: 'row',
        gap: 12,
    },
    controlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
        elevation: 4,
        shadowColor: AppColors.accentGreen,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    controlIcon: {
        fontSize: 20,
    },
    controlLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    controlButtonOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: AppColors.textMuted + '50',
        gap: 8,
    },
    controlLabelOutline: {
        fontSize: 16,
        fontWeight: '600',
        color: AppColors.textSecondary,
    },

    // ─── No Text ────────────────────────────────────────────
    noTextContainer: {
        alignItems: 'center',
        paddingTop: 20,
    },
    noTextImage: {
        width: 240,
        height: 240,
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: AppColors.error + '40',
        opacity: 0.7,
    },
    noTextCard: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: AppColors.surfaceCard,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: AppColors.error + '30',
        marginBottom: 20,
        width: '100%',
    },
    noTextEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    noTextTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: AppColors.textPrimary,
        marginBottom: 8,
    },
    noTextSubtitle: {
        fontSize: 14,
        color: AppColors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 16,
        gap: 10,
        elevation: 4,
    },
    retryIcon: {
        fontSize: 20,
    },
    retryLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
