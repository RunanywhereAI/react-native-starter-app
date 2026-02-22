import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Image,
    Animated,
    ActivityIndicator,
    Share,
    Alert,
    Vibration,
    Platform,
    Modal,
    NativeModules,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import { RunAnywhere } from '@runanywhere/core';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { AppColors } from '../theme';
import { analyzeImage } from '../utils/VisionPipeline';
import { buildIndexableContent } from '../utils/TextEnrichment';
import { indexDocument } from '../Database';
import Clipboard from '@react-native-clipboard/clipboard';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';

const { NativeAudioModule } = NativeModules;

// ─── Clipboard Icon Component ────────────────────────────────────────────────
const ClipboardIcon: React.FC<{ size?: number; color?: string }> = ({
    size = 56,
    color = '#00D9FF',
}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="5" y="4" width="14" height="17" rx="2" stroke={color} strokeWidth="2" fill="none" />
        <Path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" fill={color} />
        <Path d="M8 10h8M8 14h8M8 18h5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

// ─── Modern Speaker Icon (SVG) ───────────────────────────────────────────────
const SpeakerIconSVG: React.FC<{ size?: number; color?: string }> = ({
    size = 22,
    color = '#00D9FF',
}) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M11 5L6 9H2V15H6L11 19V5Z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M15.54 8.46a5 5 0 0 1 0 7.07"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
        />
        <Path
            d="M19.07 4.93a10 10 0 0 1 0 14.14"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

// ─── Clipboard History Item ──────────────────────────────────────────────────
interface ClipboardItem {
    id: number;
    text: string;
    source: string; // 'camera' | 'gallery'
    timestamp: Date;
    imageUri?: string;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export const SmartClipboardScreen: React.FC = () => {
    const route = useRoute<RouteProp<RootStackParamList, 'SmartClipboard'>>();
    const navigation = useNavigation<any>();

    // --- State ---
    const [imageUri, setImageUri] = useState<string | null>(route.params?.scanUri || null);
    const [extractedText, setExtractedText] = useState('');
    const [editedText, setEditedText] = useState('');
    const [isProcessing, setIsProcessing] = useState<boolean>(!!route.params?.scanUri);
    const [detectionType, setDetectionType] = useState<string>('');
    const [clipHistory, setClipHistory] = useState<ClipboardItem[]>([]);
    const [showCopied, setShowCopied] = useState(false);

    const [isImageModalVisible, setImageModalVisible] = useState(false);

    // Audio TTS state
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const toastAnim = useRef(new Animated.Value(0)).current;

    // Animate result in
    const animateResultIn = () => {
        fadeAnim.setValue(0);
        slideAnim.setValue(30);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 80,
                friction: 12,
                useNativeDriver: true,
            }),
        ]).start();
    };

    // Toast animation

    const showToast = (type: 'copy') => {
        if (type === 'copy') setShowCopied(true);

        toastAnim.setValue(0);
        Animated.sequence([
            Animated.spring(toastAnim, {
                toValue: 1,
                tension: 100,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.delay(1200),
            Animated.timing(toastAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setShowCopied(false);
        });
    };

    // Pulse animation for processing
    useEffect(() => {
        if (isProcessing) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [isProcessing, pulseAnim]);

    // Cleanup helper for audio
    const stopTTSAndAudio = () => {
        if (isSynthesizing) {
            RunAnywhere.stopSynthesis().catch(() => { });
            setIsSynthesizing(false);
        }
        if (isPlaying && NativeAudioModule) {
            NativeAudioModule.stopPlayback().catch(() => { });
            setIsPlaying(false);
        }
    };

    // Auto-scan from route parameters (Deep Link from Pinpointer)
    useEffect(() => {
        if (route.params?.scanUri) {
            const uriToScan = route.params.scanUri;
            // Clear the param immediately so it doesn't re-trigger on back/forward
            navigation.setParams({ scanUri: undefined });

            // Small delay to let the screen transition finish before heavy OCR blocking
            setTimeout(() => {
                processImage(uriToScan);
            }, 400);
        }
    }, [route.params?.scanUri]);

    // ─── Actions ─────────────────────────────────────────────────────────────

    const processImage = async (uri: string) => {
        stopTTSAndAudio();
        setImageUri(uri);
        setIsProcessing(true);
        setExtractedText('');
        setEditedText('');
        setDetectionType('');

        try {
            const result = await analyzeImage(uri);

            if (result.detection_type === 'EMPTY') {
                setExtractedText('');
                setEditedText('');
                setDetectionType('EMPTY');
                Alert.alert(
                    'No Text Found',
                    'Could not detect any text or objects in this image. Try a clearer photo.'
                );
            } else {
                setExtractedText(result.raw_text);
                setEditedText(result.raw_text);
                setDetectionType(result.detection_type);
                Vibration.vibrate(50); // success haptic
                animateResultIn();
            }
        } catch (error) {
            console.error('[SmartClipboard] OCR error:', error);
            Alert.alert('Scan Error', 'Failed to process the image. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCamera = async () => {
        try {
            const result = await launchCamera({
                mediaType: 'photo',
                quality: 0.5,
                maxWidth: 1024,
                maxHeight: 1024,
                saveToPhotos: false,
            });
            if (result.assets?.[0]?.uri) {
                processImage(result.assets[0].uri);
            }
        } catch (err) {
            console.error('[SmartClipboard] Camera error:', err);
        }
    };

    const handleGallery = async () => {
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                quality: 0.5,
                maxWidth: 1024,
                maxHeight: 1024,
            });
            if (result.assets?.[0]?.uri) {
                processImage(result.assets[0].uri);
            }
        } catch (err) {
            console.error('[SmartClipboard] Gallery error:', err);
        }
    };

    const handleCopy = () => {
        if (!editedText.trim()) return;
        Clipboard.setString(editedText.trim());
        Vibration.vibrate(30);
        showToast('copy');

        // Add to history
        const item: ClipboardItem = {
            id: Date.now(),
            text: editedText.trim(),
            source: 'scan',
            timestamp: new Date(),
            imageUri: imageUri || undefined,
        };
        setClipHistory((prev) => [item, ...prev].slice(0, 20)); // keep last 20
    };

    const handleShare = async () => {
        if (!editedText.trim()) return;
        try {
            await Share.share({ message: editedText.trim() });
        } catch (e) {
            console.error('[SmartClipboard] Share error:', e);
        }
    };

    const handleSave = () => {
        if (!editedText.trim() || !imageUri) return;
        indexDocument(
            null,
            editedText.trim(),
            imageUri,
            'IMAGE',
            (detectionType as 'TEXT' | 'OBJECT') || 'TEXT'
        );
        Vibration.vibrate(30);
        Alert.alert('Saved', 'Text has been saved to your library.');
    };

    const handleReset = () => {
        stopTTSAndAudio();
        setImageUri(null);
        setExtractedText('');
        setEditedText('');
        setDetectionType('');
    };

    const copyHistoryItem = (text: string) => {
        Clipboard.setString(text);
        Vibration.vibrate(30);
        showToast('copy');
    };

    // Cleanup audio on unmount or blur
    useEffect(() => {
        const unsubscribe = navigation.addListener('blur', () => {
            stopTTSAndAudio();
        });

        return () => {
            unsubscribe();
            stopTTSAndAudio();
        };
    }, [navigation, isPlaying, isSynthesizing]);

    const handleSpeakText = async () => {
        if (!editedText.trim()) return;

        // Toggle stop if already playing
        if (isPlaying && NativeAudioModule) {
            NativeAudioModule.stopPlayback().catch(() => { });
            setIsPlaying(false);
            return;
        }

        setIsSynthesizing(true);
        try {
            const result = await RunAnywhere.synthesize(editedText.trim(), {
                voice: 'default',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0,
            });

            const tempPath = await RunAnywhere.Audio.createWavFromPCMFloat32(
                result.audio,
                result.sampleRate || 22050
            );

            setCurrentAudioPath(tempPath);
            setIsSynthesizing(false);
            setIsPlaying(true);

            if (NativeAudioModule) {
                try {
                    const playResult = await NativeAudioModule.playAudio(tempPath);
                    setTimeout(() => {
                        setIsPlaying(false);
                        setCurrentAudioPath(null);
                        RNFS.unlink(tempPath).catch(() => { });
                    }, (result.duration + 0.5) * 1000);
                } catch (playError) {
                    console.error('[SmartClipboard] Playback error:', playError);
                    setIsPlaying(false);
                }
            } else {
                setIsPlaying(false);
            }
        } catch (error) {
            console.error('[SmartClipboard] TTS error:', error);
            setIsSynthesizing(false);
            setIsPlaying(false);
            Alert.alert("Speech Error", "Could not generate speech right now.");
        }
    };

    // ─── Render: Landing State ────────────────────────────────────────────────

    const renderLanding = () => (
        <View style={styles.landingContainer}>
            {/* Hero Icon */}
            <View style={styles.heroSection}>
                <LinearGradient
                    colors={[AppColors.accentCyan + '20', AppColors.accentCyan + '05']}
                    style={styles.heroGlow}
                >
                    <ClipboardIcon size={60} color={AppColors.accentCyan} />
                </LinearGradient>
                <Text style={styles.heroTitle}>Smart Clipboard</Text>
                <Text style={styles.heroSubtitle}>
                    Copy text from the real world — signs, books, labels, whiteboards
                </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                <TouchableOpacity onPress={handleCamera} activeOpacity={0.85}>
                    <LinearGradient
                        colors={[AppColors.accentCyan, '#0891B2']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryButton}
                    >
                        <Text style={styles.primaryButtonText}>Take Photo</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleGallery}
                    activeOpacity={0.85}
                    style={styles.secondaryButton}
                >
                    <Text style={styles.secondaryButtonText}>Pick from Gallery</Text>
                </TouchableOpacity>
            </View>

            {/* Clipboard History */}
            {clipHistory.length > 0 && (
                <View style={styles.historySection}>
                    <View style={styles.historyHeader}>
                        <Text style={styles.historyTitle}>📌 Recent Clips</Text>
                        <TouchableOpacity onPress={() => setClipHistory([])}>
                            <Text style={styles.historyClear}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                    {clipHistory.slice(0, 5).map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.historyItem}
                            onPress={() => copyHistoryItem(item.text)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.historyText} numberOfLines={2}>
                                {item.text}
                            </Text>
                            <Text style={styles.historyMeta}>
                                {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );

    // ─── Render: Result State ─────────────────────────────────────────────────

    const renderResult = () => (
        <Animated.View
            style={[
                styles.resultContainer,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
        >
            {/* Image Preview */}
            {imageUri && (
                <View style={styles.imagePreviewCard}>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => setImageModalVisible(true)}>
                        <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                        <View style={styles.imageOverlay}>
                            <View style={styles.detectionBadge}>
                                <Text style={styles.detectionBadgeText}>
                                    {detectionType === 'TEXT' ? '✅ Text Detected' : '🏷️ Objects Detected'}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {/* Extracted Text Card */}
            <View style={styles.textCard}>
                <View style={styles.textCardHeader}>
                    <Text style={styles.textCardTitle}>Extracted Text</Text>
                    <TouchableOpacity
                        style={styles.speakerButton}
                        activeOpacity={0.7}
                        onPress={handleSpeakText}
                        disabled={isSynthesizing}
                    >
                        {isSynthesizing ? (
                            <ActivityIndicator size="small" color={AppColors.accentCyan} />
                        ) : (
                            <SpeakerIconSVG color={isPlaying ? AppColors.accentPink : AppColors.accentCyan} />
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.textEditorContainer}>
                    <ScrollView style={styles.textEditorScroll} nestedScrollEnabled={true}>
                        <TextInput
                            style={styles.textEditor}
                            value={editedText}
                            onChangeText={setEditedText}
                            multiline
                            scrollEnabled={false}
                            placeholder="No text extracted..."
                            placeholderTextColor={AppColors.textMuted}
                            selectionColor={AppColors.accentCyan}
                        />
                    </ScrollView>
                </View>

                {/* Character Count */}
                <View style={styles.charCountContainer}>
                    <Text style={styles.charCount}>{editedText.length} chars</Text>
                </View>

                {/* Action Bar */}
                <View style={styles.actionBar}>
                    <View style={styles.actionRow}>
                        <TouchableOpacity onPress={handleCopy} style={styles.actionButton} activeOpacity={0.7}>
                            <LinearGradient
                                colors={[AppColors.accentCyan, '#0891B2']}
                                style={styles.actionButtonGradient}
                            >
                                <Text style={styles.actionLabel}>Copy</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleShare} style={styles.actionButton} activeOpacity={0.7}>
                            <View style={styles.actionButtonOutline}>
                                <Text style={styles.actionLabelOutline}>Share</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={handleReset}
                        style={styles.scanAnotherButton}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.actionLabelOutline}>Scan Another</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );

    // ─── Render: Processing State ─────────────────────────────────────────────

    const renderProcessing = () => (
        <View style={styles.processingContainer}>
            {imageUri && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Image source={{ uri: imageUri }} style={styles.processingImage} resizeMode="cover" />
                    <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color={AppColors.accentCyan} />
                    </View>
                </Animated.View>
            )}
            <Text style={styles.processingText}>Extracting text...</Text>
            <Text style={styles.processingSubtext}>Running OCR (Hindi + English) on your image</Text>
        </View>
    );

    // ─── Toast ────────────────────────────────────────────────────────────────

    const renderToast = () => {
        if (!showCopied) return null;
        return (
            <Animated.View
                style={[
                    styles.toast,
                    {
                        transform: [
                            {
                                translateY: toastAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-60, 0],
                                }),
                            },
                        ],
                        opacity: toastAnim,
                    },
                ]}
            >
                <LinearGradient
                    colors={[AppColors.accentGreen, '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.toastGradient}
                >
                    <Text style={styles.toastText}>{showCopied ? '✅ Copied to clipboard!' : ''}</Text>
                </LinearGradient>
            </Animated.View>
        );
    };

    // ─── Main Render ──────────────────────────────────────────────────────────

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {isProcessing
                    ? renderProcessing()
                    : extractedText || detectionType === 'EMPTY'
                        ? renderResult()
                        : renderLanding()}
            </ScrollView>

            {renderToast()}

            {/* Full Screen Image Modal */}
            <Modal
                visible={isImageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setImageModalVisible(false)}
            >
                <View style={styles.modalBackground}>
                    <TouchableOpacity
                        style={styles.modalCloseArea}
                        activeOpacity={1}
                        onPress={() => setImageModalVisible(false)}
                    >
                        <Image
                            source={{ uri: imageUri || undefined }}
                            style={styles.modalImage}
                            resizeMode="contain"
                        />
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setImageModalVisible(false)}
                        >
                            <Text style={styles.modalCloseText}>✕</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>
            </Modal>
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

    // ─── Landing ────────────────────────────────────────────
    landingContainer: {
        flex: 1,
    },
    heroSection: {
        alignItems: 'center',
        paddingTop: 80,
        marginBottom: 40,
    },
    heroGlow: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    heroIcon: {
        fontSize: 56,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: AppColors.textPrimary,
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 15,
        color: AppColors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },

    // ─── Buttons ────────────────────────────────────────────
    actionButtons: {
        gap: 14,
        marginBottom: 28,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 16,
        elevation: 6,
        shadowColor: AppColors.accentCyan,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
    },
    primaryButtonIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    primaryButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: AppColors.accentCyan + '50',
        backgroundColor: AppColors.accentCyan + '10',
    },
    secondaryButtonIcon: {
        fontSize: 22,
        marginRight: 10,
    },
    secondaryButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: AppColors.accentCyan,
    },

    // ─── Feature Pills ─────────────────────────────────────
    featurePills: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 32,
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: AppColors.surfaceCard,
        borderWidth: 1,
        borderColor: AppColors.textMuted + '30',
    },
    pillText: {
        fontSize: 12,
        color: AppColors.textSecondary,
        fontWeight: '500',
    },

    // ─── History ────────────────────────────────────────────
    historySection: {
        marginTop: 8,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    historyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: AppColors.textPrimary,
    },
    historyClear: {
        fontSize: 14,
        color: AppColors.accentCyan,
        fontWeight: '600',
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: AppColors.surfaceCard,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: AppColors.textMuted + '1A',
        marginBottom: 8,
    },
    historyText: {
        flex: 1,
        fontSize: 13,
        color: AppColors.textSecondary,
        lineHeight: 18,
    },
    historyMeta: {
        fontSize: 11,
        color: AppColors.textMuted,
        marginLeft: 10,
    },

    // ─── Processing ─────────────────────────────────────────
    processingContainer: {
        alignItems: 'center',
        paddingTop: 40,
    },
    processingImage: {
        width: 260,
        height: 260,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: AppColors.accentCyan + '60',
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 20,
        backgroundColor: AppColors.primaryDark + 'AA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        fontSize: 18,
        fontWeight: '600',
        color: AppColors.textPrimary,
        marginTop: 24,
    },
    processingSubtext: {
        fontSize: 13,
        color: AppColors.textMuted,
        marginTop: 6,
    },

    // ─── Result ─────────────────────────────────────────────
    resultContainer: {
        flex: 1,
    },
    imagePreviewCard: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: AppColors.accentCyan + '30',
    },
    imagePreview: {
        width: '100%',
        height: 200,
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        backgroundColor: AppColors.primaryDark + 'CC',
    },
    detectionBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: AppColors.accentCyan + '25',
    },
    detectionBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: AppColors.accentCyan,
    },

    // ─── Text Card ──────────────────────────────────────────
    textCard: {
        backgroundColor: AppColors.surfaceCard,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: AppColors.accentCyan + '30',
        overflow: 'hidden',
        marginBottom: 20,
    },
    textCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingBottom: 0,
    },
    textCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: AppColors.textPrimary,
    },
    speakerButton: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: AppColors.accentCyan + '15',
        borderWidth: 1,
        borderColor: AppColors.accentCyan + '30',
    },
    charCountContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        alignItems: 'flex-end',
    },
    charCount: {
        fontSize: 12,
        color: AppColors.textMuted,
    },
    textEditorContainer: {
        height: 200, // Fixed height for the editor container
        margin: 16,
        backgroundColor: AppColors.primaryDark + '30',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: AppColors.textMuted + '20',
    },
    textEditorScroll: {
        flex: 1,
    },
    textEditor: {
        padding: 12,
        fontSize: 15,
        color: AppColors.textPrimary,
        lineHeight: 22,
        textAlignVertical: 'top',
    },

    // ─── Action Bar ─────────────────────────────────────────
    actionBar: {
        flexDirection: 'column',
        padding: 16,
        gap: 12,
        backgroundColor: AppColors.primaryMid,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
    },
    actionButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        elevation: 4,
        shadowColor: AppColors.accentCyan,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    actionButtonOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: AppColors.accentCyan + '40',
        backgroundColor: AppColors.accentCyan + '08',
    },
    scanAnotherButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: AppColors.accentCyan + '40',
        backgroundColor: AppColors.accentCyan + '08',
    },
    actionLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    actionLabelOutline: {
        fontSize: 15,
        fontWeight: '600',
        color: AppColors.accentCyan,
        letterSpacing: 0.3,
    },

    // ─── New Scan ───────────────────────────────────────────
    newScanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: AppColors.surfaceCard,
        borderWidth: 1,
        borderColor: AppColors.textMuted + '30',
        gap: 8,
    },
    newScanIcon: {
        fontSize: 18,
    },
    newScanText: {
        fontSize: 15,
        fontWeight: '600',
        color: AppColors.textSecondary,
    },

    // ─── Toast ──────────────────────────────────────────────
    toast: {
        position: 'absolute',
        top: 12,
        left: 24,
        right: 24,
        zIndex: 100,
    },
    toastGradient: {
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        elevation: 8,
        shadowColor: AppColors.accentGreen,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    toastText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // ─── Image Modal ────────────────────────────────────────
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCloseArea: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalImage: {
        width: '100%',
        height: '80%',
    },
    modalCloseButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCloseText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
});
