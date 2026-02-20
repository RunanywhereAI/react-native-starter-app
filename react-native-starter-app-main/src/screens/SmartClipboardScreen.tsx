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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { AppColors } from '../theme';
import { analyzeImage } from '../utils/VisionPipeline';
import { buildIndexableContent } from '../utils/TextEnrichment';
import { indexDocument } from '../Database';
import Clipboard from '@react-native-clipboard/clipboard';

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
    // --- State ---
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState('');
    const [editedText, setEditedText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [detectionType, setDetectionType] = useState<string>('');
    const [clipHistory, setClipHistory] = useState<ClipboardItem[]>([]);
    const [showCopied, setShowCopied] = useState(false);
    const [showSaved, setShowSaved] = useState(false);

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
    const showToast = (type: 'copy' | 'save') => {
        if (type === 'copy') setShowCopied(true);
        else setShowSaved(true);

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
            setShowSaved(false);
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
                ]),
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [isProcessing, pulseAnim]);

    // ─── Actions ─────────────────────────────────────────────────────────────

    const processImage = async (uri: string) => {
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
                Alert.alert('No Text Found', 'Could not detect any text or objects in this image. Try a clearer photo.');
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
                quality: 1,
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
                quality: 1,
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
        setClipHistory(prev => [item, ...prev].slice(0, 20)); // keep last 20
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
        indexDocument(editedText.trim(), imageUri, 'Smart Clipboard', detectionType as any || 'TEXT');
        Vibration.vibrate(30);
        showToast('save');
    };

    const handleReset = () => {
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

    // ─── Render: Landing State ────────────────────────────────────────────────

    const renderLanding = () => (
        <View style={styles.landingContainer}>
            {/* Hero Icon */}
            <View style={styles.heroSection}>
                <LinearGradient
                    colors={[AppColors.accentOrange + '20', AppColors.accentOrange + '05']}
                    style={styles.heroGlow}
                >
                    <Text style={styles.heroIcon}>📋</Text>
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
                        colors={[AppColors.accentOrange, '#E67E22']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryButton}
                    >
                        <Text style={styles.primaryButtonIcon}>📸</Text>
                        <Text style={styles.primaryButtonText}>Take Photo</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleGallery}
                    activeOpacity={0.85}
                    style={styles.secondaryButton}
                >
                    <Text style={styles.secondaryButtonIcon}>🖼️</Text>
                    <Text style={styles.secondaryButtonText}>Pick from Gallery</Text>
                </TouchableOpacity>
            </View>

            {/* Feature Pills */}
            <View style={styles.featurePills}>
                {['Hindi + English', 'Offline', 'Instant Copy'].map((label) => (
                    <View key={label} style={styles.pill}>
                        <Text style={styles.pillText}>{label}</Text>
                    </View>
                ))}
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
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                    <View style={styles.imageOverlay}>
                        <View style={styles.detectionBadge}>
                            <Text style={styles.detectionBadgeText}>
                                {detectionType === 'TEXT' ? '✅ Text Detected' : '🏷️ Objects Detected'}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Extracted Text Card */}
            <View style={styles.textCard}>
                <View style={styles.textCardHeader}>
                    <Text style={styles.textCardTitle}>Extracted Text</Text>
                    <Text style={styles.charCount}>{editedText.length} chars</Text>
                </View>

                <TextInput
                    style={styles.textEditor}
                    value={editedText}
                    onChangeText={setEditedText}
                    multiline
                    placeholder="No text extracted..."
                    placeholderTextColor={AppColors.textMuted}
                    selectionColor={AppColors.accentOrange}
                />

                {/* Action Bar */}
                <View style={styles.actionBar}>
                    <TouchableOpacity
                        onPress={handleCopy}
                        style={styles.actionButton}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={[AppColors.accentOrange, '#E67E22']}
                            style={styles.actionButtonGradient}
                        >
                            <Text style={styles.actionIcon}>📋</Text>
                            <Text style={styles.actionLabel}>Copy</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleShare}
                        style={styles.actionButton}
                        activeOpacity={0.7}
                    >
                        <View style={styles.actionButtonOutline}>
                            <Text style={styles.actionIcon}>📤</Text>
                            <Text style={styles.actionLabelOutline}>Share</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleSave}
                        style={styles.actionButton}
                        activeOpacity={0.7}
                    >
                        <View style={styles.actionButtonOutline}>
                            <Text style={styles.actionIcon}>💾</Text>
                            <Text style={styles.actionLabelOutline}>Save</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* New Scan Button */}
            <TouchableOpacity
                onPress={handleReset}
                style={styles.newScanButton}
                activeOpacity={0.7}
            >
                <Text style={styles.newScanIcon}>🔄</Text>
                <Text style={styles.newScanText}>Scan Another</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    // ─── Render: Processing State ─────────────────────────────────────────────

    const renderProcessing = () => (
        <View style={styles.processingContainer}>
            {imageUri && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.processingImage}
                        resizeMode="cover"
                    />
                    <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color={AppColors.accentOrange} />
                    </View>
                </Animated.View>
            )}
            <Text style={styles.processingText}>Extracting text...</Text>
            <Text style={styles.processingSubtext}>
                Running OCR (Hindi + English) on your image
            </Text>
        </View>
    );

    // ─── Toast ────────────────────────────────────────────────────────────────

    const renderToast = () => {
        if (!showCopied && !showSaved) return null;
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
                    <Text style={styles.toastText}>
                        {showCopied ? '✅ Copied to clipboard!' : '💾 Saved to index!'}
                    </Text>
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
        paddingTop: 20,
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
        shadowColor: AppColors.accentOrange,
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
        borderColor: AppColors.accentOrange + '50',
        backgroundColor: AppColors.accentOrange + '10',
    },
    secondaryButtonIcon: {
        fontSize: 22,
        marginRight: 10,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: AppColors.accentOrange,
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
        color: AppColors.accentOrange,
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
        borderColor: AppColors.accentOrange + '60',
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
        borderColor: AppColors.accentOrange + '30',
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
        backgroundColor: AppColors.accentOrange + '25',
    },
    detectionBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: AppColors.accentOrange,
    },

    // ─── Text Card ──────────────────────────────────────────
    textCard: {
        backgroundColor: AppColors.surfaceCard,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: AppColors.accentOrange + '30',
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
    charCount: {
        fontSize: 12,
        color: AppColors.textMuted,
    },
    textEditor: {
        padding: 16,
        fontSize: 15,
        color: AppColors.textPrimary,
        lineHeight: 22,
        minHeight: 120,
        textAlignVertical: 'top',
    },

    // ─── Action Bar ─────────────────────────────────────────
    actionBar: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
        backgroundColor: AppColors.primaryMid,
    },
    actionButton: {
        flex: 1,
    },
    actionButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
    },
    actionButtonOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: AppColors.textMuted + '40',
        gap: 6,
    },
    actionIcon: {
        fontSize: 16,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    actionLabelOutline: {
        fontSize: 14,
        fontWeight: '600',
        color: AppColors.textSecondary,
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
});
