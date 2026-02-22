import React, { useRef, useEffect, useState } from 'react';
import { SyncProgressCard, ModelDownloadSheet, SearchHistoryPanel, SearchFilterChips, FilterCategory } from '../components';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { addRecentPhoto } from '../utils/RecentPhotos';
import { DocumentRecord } from '../Database';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Pressable,
    StyleSheet,
    StatusBar,
    Animated,
    FlatList,
    Keyboard,
    Modal,
    Image,
    ScrollView,
    useWindowDimensions,
    Vibration,
    ActivityIndicator,
    Linking,
    NativeModules,
    BackHandler,
    Easing,
    Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme';
import { usePinpointer } from '../hooks/usePinpointer';
import { HomeScreen } from '../screens/HomeScreen';

const { StorageModule } = NativeModules;

export const PinpointerScreen: React.FC = () => {
    const { width, height } = useWindowDimensions();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

    const {
        searchText, setSearchText,
        searchResults,
        isSearching, setIsSearching, isSearchPending,
        selectedImage, setSelectedImage,
        isRecording, isTranscribing, isModelLoading,
        startListening, stopListening,
        handleScan, handleShare, handleEdit,
        handleQuickSync, handleDeepSync, handlePauseSync, handleResumeSync,
        isSyncing, isPaused, isDeepSync, syncCount, totalImages, lastSyncTime,
        isSyncingDocs, docSyncCount, totalDocs, lastDocSyncTime, handleDocumentSync,
        searchHistory, handleSelectHistory, handleDeleteHistory, handleClearHistory,
    } = usePinpointer();

    // --- Loading UI Animations ---
    const syncProgress = useRef(new Animated.Value(0)).current;
    const syncSpinAnim = useRef(new Animated.Value(0)).current;
    const syncFadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isSyncing || isSyncingDocs) {
            // Entrance fade
            Animated.timing(syncFadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();

            // Spinning loader
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
            // reset progress for next time
            syncProgress.setValue(0);
        }
    }, [isSyncing, isSyncingDocs, syncFadeAnim, syncSpinAnim, syncProgress]);

    // Animate progress bar as items process
    useEffect(() => {
        let targetProgress = 0;
        if (isSyncing) {
            targetProgress = Math.min(syncCount / 50, 1);
        } else if (isSyncingDocs && totalDocs > 0) {
            targetProgress = Math.min(docSyncCount / totalDocs, 1);
        }

        Animated.timing(syncProgress, {
            toValue: targetProgress,
            duration: 300, // Smooth 300ms catchup
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();
    }, [syncCount, docSyncCount, totalDocs, isSyncing, isSyncingDocs, syncProgress]); const formatRelativeTime = (timestamp: number | null) => {
        if (!timestamp) return 'Never synced';
        const now = Date.now();
        const diffInSecs = Math.floor((now - timestamp) / 1000);

        if (diffInSecs < 60) return 'now';
        if (diffInSecs < 3600) return `${Math.floor(diffInSecs / 60)}m ago`;
        if (diffInSecs < 86400) return `${Math.floor(diffInSecs / 3600)}h ago`;

        const days = Math.floor(diffInSecs / 86400);
        return days === 1 ? 'Yesterday' : `${days} days ago`;
    };

    const renderSyncButton = (label: string, subtitle: string, color: string, onPress: () => void, active: boolean) => (
        <>
            <TouchableOpacity
                style={[styles.solidButton, { backgroundColor: color, opacity: active ? 0.7 : 1 }]}
                onPress={onPress}
                disabled={active}
            >
                <Text style={styles.dashboardButtonText}>
                    {active ? 'Scanning...' : label}
                </Text>
            </TouchableOpacity>
            <Text style={styles.dashboardButtonSubtitle}>{subtitle}</Text>
        </>
    );

    const route = useRoute<RouteProp<RootStackParamList, 'Pinpointer'>>();

    const [showModelSheet, setShowModelSheet] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('ALL');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const scrollViewRef = useRef<ScrollView>(null);
    const searchInputRef = useRef<TextInput>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const resultsSlideAnim = useRef(new Animated.Value(20)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;
    const drawerAnim = useRef(new Animated.Value(-width)).current;
    const orbScaleAnim = useRef(new Animated.Value(1)).current;
    const gVoiceAnim1 = useRef(new Animated.Value(1)).current;
    const gVoiceAnim2 = useRef(new Animated.Value(1)).current;
    const gVoiceAnim3 = useRef(new Animated.Value(1)).current;
    const gVoiceAnim4 = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const startBreathing = () => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(orbScaleAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
                    Animated.timing(orbScaleAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
                ])
            ).start();
        };
        startBreathing();
    }, [orbScaleAnim]);

    useEffect(() => {
        if (isRecording) {
            const startBounce = (anim: Animated.Value, delay: number) => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, { toValue: 1.5, duration: 400, delay, useNativeDriver: true }),
                        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true })
                    ])
                ).start();
            };
            startBounce(gVoiceAnim1, 0);
            startBounce(gVoiceAnim2, 150);
            startBounce(gVoiceAnim3, 300);
            startBounce(gVoiceAnim4, 450);
        } else {
            gVoiceAnim1.stopAnimation(); gVoiceAnim1.setValue(1);
            gVoiceAnim2.stopAnimation(); gVoiceAnim2.setValue(1);
            gVoiceAnim3.stopAnimation(); gVoiceAnim3.setValue(1);
            gVoiceAnim4.stopAnimation(); gVoiceAnim4.setValue(1);
        }
    }, [isRecording, gVoiceAnim1, gVoiceAnim2, gVoiceAnim3, gVoiceAnim4]);

    const openDrawer = () => {
        setIsDrawerOpen(true);
        Animated.timing(drawerAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeDrawer = () => {
        Animated.timing(drawerAnim, {
            toValue: -width,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setIsDrawerOpen(false);
        });
    };

    useEffect(() => {
        const backAction = () => {
            if (isDrawerOpen) {
                closeDrawer();
                return true;
            }
            // First behavior: cancel search if search is active
            if (isSearching) {
                Keyboard.dismiss();
                setIsSearching(false);
                // Delay state clearing so the Animated.timing isn't dropped by 
                // native layout shifts caused by unmounting the Results List
                setTimeout(() => {
                    setSearchText('');
                }, 300);
                return true;
            }
            // Secondary behavior: go back to previous screen (exit)
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [isSearching, isDrawerOpen]);

    useEffect(() => {
        if (isSearching) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(resultsSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
                Animated.timing(resultsSlideAnim, { toValue: 20, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 1200, duration: 250, useNativeDriver: true })
            ]).start();
        }
    }, [isSearching]); // Only trigger when isSearching explicitly toggles

    // Handle Deep Sync trigger from HomeScreen Navigation
    useEffect(() => {
        if (route.params?.startUniversalSync) {
            // Automatically launch the heavy gallery sync
            handleDeepSync();
            // Clear parameter so it doesn't re-trigger on subsequent un-related mounts
            navigation.setParams({ startUniversalSync: false });
        }
    }, [route.params?.startUniversalSync]);

    const handleBackPress = () => {
        Keyboard.dismiss();
        setIsSearching(false);
        // Delay state clearing so the Animated.timing isn't dropped by 
        // native layout shifts caused by unmounting the Results List
        setTimeout(() => {
            setSearchText('');
        }, 300);
    };

    const handleSearchFocus = () => {
        setIsSearching(true);
    };

    const openImage = async (uri: string) => {
        Vibration.vibrate(10); // Light tick
        setSelectedImage(uri);
        await addRecentPhoto(uri);
    };

    const renderResultItem = ({ item }: { item: DocumentRecord }) => (
        <TouchableOpacity
            style={styles.resultItem}
            onPress={() => {
                if (item.type === 'DOCUMENT') {
                    if (StorageModule && StorageModule.openPDF) {
                        StorageModule.openPDF(item.filePath.replace('file://', ''));
                    } else {
                        Linking.openURL(item.filePath).catch(e => console.error(e));
                    }
                } else {
                    openImage(item.filePath);
                }
            }}
            accessibilityLabel={`View file: ${item.content?.substring(0, 40)} `}
            accessibilityRole="button"
        >
            {/* Thumbnail */}
            <View style={styles.resultIconContainer}>
                {item.type === 'DOCUMENT' ? (
                    <Text style={{ fontSize: 32 }}>📄</Text>
                ) : (
                    <Image
                        source={{ uri: item.filePath }}
                        style={styles.resultThumbnail}
                        resizeMode="cover"
                    />
                )}
            </View>
            <View style={styles.resultTextContainer}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                    {item.type === 'DOCUMENT' ? (item.title || item.filePath.split('/').pop()) : item.content}
                </Text>
                <Text style={styles.resultSubtitle}>
                    {item.type === 'DOCUMENT'
                        ? '📄 Document • Tap to open'
                        : (item.detection_type === 'OBJECT' ? '🏷 Object' : '📝 Text') + ' • Tap to view'}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const page = Math.round(offsetX / width);
        if (page !== currentPage) {
            setCurrentPage(page);
        }
    };

    // ─── Search Bar / Google Voice Component ────────────────────
    const renderSearchBar = (isTop: boolean = false) => (
        <View style={[styles.glassSearchBarContainer, isTop ? styles.searchBarTopSearch : styles.searchBarBottomNormal]}>
            {isRecording ? (
                <View style={styles.googleVoiceContainer}>
                    <Animated.View style={[styles.voiceCircle, { backgroundColor: 'rgba(66, 133, 244, 1)', transform: [{ scale: gVoiceAnim1 }] }]} />
                    <Animated.View style={[styles.voiceCircle, { backgroundColor: 'rgba(234, 67, 53, 1)', transform: [{ scale: gVoiceAnim2 }] }]} />
                    <Animated.View style={[styles.voiceCircle, { backgroundColor: 'rgba(251, 188, 5, 1)', transform: [{ scale: gVoiceAnim3 }] }]} />
                    <Animated.View style={[styles.voiceCircle, { backgroundColor: 'rgba(52, 168, 83, 1)', transform: [{ scale: gVoiceAnim4 }] }]} />
                    <TouchableOpacity
                        style={styles.voiceStopButton}
                        onPress={stopListening}
                        accessibilityLabel="Stop recording"
                        accessibilityRole="button"
                    >
                        <View style={styles.voiceStopSquare} />
                    </TouchableOpacity>
                </View>
            ) : (
                <Pressable onPressIn={!isTop ? handleSearchFocus : undefined} style={styles.glassSearchPill}>
                    <TextInput
                        ref={searchInputRef}
                        style={styles.glassSearchInput}
                        placeholder="Search on Pinpointer..."
                        placeholderTextColor="#6B7280"
                        value={searchText}
                        onChangeText={setSearchText}
                        onFocus={handleSearchFocus}
                        autoFocus={isSearching}
                        pointerEvents={isTop ? 'auto' : 'none'}
                        editable={isTop}
                        accessibilityLabel="Search documents"
                    />
                    <TouchableOpacity
                        style={styles.glassMicButton}
                        onPress={startListening}
                        disabled={isTranscribing || isModelLoading}
                        accessibilityLabel="Start voice search"
                        accessibilityRole="button"
                    >
                        {isTranscribing || isModelLoading ? (
                            <Text style={styles.glassMicIcon}>⏳</Text>
                        ) : (
                            <View style={{ alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                                <View style={{ width: 8, height: 12, borderRadius: 4, backgroundColor: '#9CA3AF' }} />
                                <View style={{ position: 'absolute', bottom: 5, width: 14, height: 10, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: '#9CA3AF', borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }} />
                                <View style={{ position: 'absolute', bottom: 2, width: 1.5, height: 3, backgroundColor: '#9CA3AF' }} />
                                <View style={{ position: 'absolute', bottom: 0, width: 8, height: 1.5, backgroundColor: '#9CA3AF', borderRadius: 1 }} />
                            </View>
                        )}
                    </TouchableOpacity>
                </Pressable>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#05050A" />
            <View style={styles.glassBackground}>
                {/* Aurora Background */}
                <View style={styles.aurora1} />
                <View style={styles.aurora2} />
                <View style={styles.aurora3} />
            </View>

            <View style={{ flex: 1 }}>
                {/* ────── NORMAL MODE (Glassmorphism Dashboard) ────── */}
                <View style={StyleSheet.absoluteFillObject}>
                    <View style={styles.glassHeaderRow}>
                        <TouchableOpacity
                            style={styles.headerMenuButton}
                            onPress={openDrawer}
                            accessibilityLabel="Open menu"
                        >
                            <Text style={{ color: '#FFF', fontSize: 24 }}>☰</Text>
                        </TouchableOpacity>
                        <Text style={styles.glassHeaderTitle}>Pinpointer</Text>
                    </View>

                    <View style={styles.dashboardMiddleSection}>
                        <View style={{ flex: 1 }} />

                        <View style={styles.indexingCard}>
                            {(isSyncing || isSyncingDocs) && !isDeepSync ? (
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
                                                {isSyncing
                                                    ? `Analyzing images on-device...`
                                                    : `Analyzing docs on-device...`}
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
                                <View style={styles.dashboardActions}>
                                    <View style={styles.actionColumn}>
                                        {renderSyncButton(
                                            'Scan Images',
                                            `last synced ${formatRelativeTime(lastSyncTime)}`,
                                            '#0F766E',
                                            handleQuickSync,
                                            isSyncing
                                        )}
                                    </View>
                                    <View style={styles.actionColumn}>
                                        {renderSyncButton(
                                            'Scan docs',
                                            `last synced ${formatRelativeTime(lastDocSyncTime)}`,
                                            '#4C1D95',
                                            handleDocumentSync,
                                            isSyncingDocs
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Filling the Middle Void */}
                        <View style={styles.middleVoidContainer}>
                            <Text style={styles.middleVoidText}>Ready to search your offline vault.</Text>
                            <View style={styles.suggestionRow}>
                                <TouchableOpacity
                                    style={styles.suggestionPill}
                                    onPress={() => {
                                        setSearchText('Aadhaar');
                                        setIsSearching(true);
                                    }}
                                >
                                    <Text style={styles.suggestionText}>Find Aadhaar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.suggestionPill}
                                    onPress={() => {
                                        setSearchText('cat');
                                        setIsSearching(true);
                                    }}
                                >
                                    <Text style={styles.suggestionText}>Image of my cat</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* The new search bar will be injected below this via the shared renderSearchBar() */}
                        {renderSearchBar(false)}
                    </View>
                </View>

                {/* ────── SEARCHING MODE OVERLAY ────── */}
                <Animated.View
                    pointerEvents={isSearching ? 'auto' : 'none'}
                    style={[
                        StyleSheet.absoluteFillObject,
                        { zIndex: 100, backgroundColor: '#05050A', opacity: fadeAnim }
                    ]}
                >
                    <View style={styles.glassBackground}>
                        {/* Aurora Background overlay for drawer */}
                        <View style={styles.aurora1} />
                        <View style={styles.aurora2} />
                        <View style={styles.aurora3} />
                    </View>

                    <View style={styles.glassHeaderRow}>
                        <Pressable
                            onPressIn={handleBackPress}
                            style={styles.headerMenuButton}
                            accessibilityLabel="Close search"
                        >
                            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ width: 12, height: 12, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: '#9CA3AF', transform: [{ rotate: '45deg' }] }} />
                            </View>
                        </Pressable>
                        <Text style={styles.glassHeaderTitle}>Pinpointer</Text>
                    </View>

                    <Animated.View style={[styles.searchingContainer, { transform: [{ translateY: slideAnim }] }]}>
                        {/* Search bar pinned at top */}
                        {renderSearchBar(true)}

                        {/* Search History — shown when focused but no text typed */}
                        {!searchText.trim() ? (
                            <View style={styles.searchContentArea}>
                                <SearchHistoryPanel
                                    history={searchHistory}
                                    onSelect={handleSelectHistory}
                                    onDelete={handleDeleteHistory}
                                    onClearAll={handleClearHistory}
                                />
                            </View>
                        ) : (
                            /* Results Section */
                            <Animated.View
                                style={[
                                    styles.resultsContainer,
                                    { opacity: fadeAnim, transform: [{ translateY: resultsSlideAnim }] }
                                ]}
                            >
                                <SearchFilterChips
                                    selectedFilter={selectedFilter}
                                    onSelectFilter={setSelectedFilter}
                                />
                                <Text style={styles.sectionHeader}>
                                    {selectedFilter === 'ALL' ? 'Top Results' : (selectedFilter === 'IMAGE' ? 'Found in Photos' : 'Found in Documents')}
                                </Text>
                                <FlatList
                                    data={searchResults.filter(item => selectedFilter === 'ALL' || item.type === selectedFilter)}
                                    renderItem={renderResultItem}
                                    keyExtractor={(item) => item.filePath || String(item.id)}
                                    contentContainerStyle={styles.resultsList}
                                    showsVerticalScrollIndicator={false}
                                    ListEmptyComponent={
                                        isSearchPending ? (
                                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                                <ActivityIndicator size="large" color={AppColors.accentCyan} />
                                            </View>
                                        ) : (
                                            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                                                <Text style={styles.subTitle}>No matches found.</Text>
                                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>
                                                    Not in the last 300 photos?
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        // 1. Close Search State
                                                        Keyboard.dismiss();
                                                        setIsSearching(false);

                                                        // Delay state clearing so the Animated.timing isn't dropped by 
                                                        // native layout shifts caused by unmounting the Results List
                                                        setTimeout(() => {
                                                            setSearchText('');
                                                        }, 300);

                                                        // 2. Open the Home Screen Drawer
                                                        openDrawer();

                                                        // 3. Trigger Universal Sync
                                                        handleDeepSync();
                                                        handleDocumentSync();
                                                    }}
                                                    style={{
                                                        marginTop: 12,
                                                        backgroundColor: 'rgba(138,43,226,0.3)',
                                                        paddingHorizontal: 20,
                                                        paddingVertical: 10,
                                                        borderRadius: 20,
                                                        borderWidth: 1,
                                                        borderColor: 'rgba(138,43,226,0.6)',
                                                    }}
                                                    accessibilityLabel="Start Universal Sync"
                                                    accessibilityRole="button"
                                                >
                                                    <Text style={{ color: '#E9D5FF', fontWeight: 'bold' }}>
                                                        ⚡ Start Universal Sync
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        )
                                    }
                                />
                            </Animated.View>
                        )}
                    </Animated.View>
                </Animated.View>
            </View>

            {/* GALLERY PREVIEW MODAL */}
            <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity
                            onPress={() => setSelectedImage(null)}
                            accessibilityLabel="Close image"
                            accessibilityRole="button"
                        >
                            <Text style={styles.headerIcon}>✕</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row' }}>
                            <TouchableOpacity
                                onPress={() => {
                                    if (selectedImage) {
                                        const uri = selectedImage;
                                        setSelectedImage(null);
                                        navigation.navigate('SmartClipboard', { scanUri: uri });
                                    }
                                }}
                                style={{ marginRight: 25 }}
                                accessibilityLabel="Scan image"
                                accessibilityRole="button"
                            >
                                <Text style={styles.headerIcon}>🔍</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleEdit}
                                style={{ marginRight: 25 }}
                                accessibilityLabel="Edit image"
                                accessibilityRole="button"
                            >
                                <Text style={styles.headerIcon}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleShare}
                                accessibilityLabel="Share image"
                                accessibilityRole="button"
                            >
                                <Text style={styles.headerIcon}>📤</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <ScrollView maximumZoomScale={5} contentContainerStyle={styles.scrollContainer}>
                        {selectedImage && (
                            <Image
                                source={{ uri: selectedImage }}
                                style={{ width: width, height: height * 0.8 }}
                                resizeMode="contain"
                            />
                        )}
                    </ScrollView>
                </View>
            </Modal>

            {/* MODEL DOWNLOAD SHEET */}
            <ModelDownloadSheet
                visible={showModelSheet}
                onClose={() => setShowModelSheet(false)}
            />

            {/* SLIDING DRAWER & OVERLAY */}
            {isDrawerOpen && (
                <TouchableWithoutFeedback onPress={closeDrawer}>
                    <Animated.View style={styles.drawerOverlay} />
                </TouchableWithoutFeedback>
            )}
            <Animated.View
                style={[
                    styles.drawerContainer,
                    { transform: [{ translateX: drawerAnim }] }
                ]}
            >
                <HomeScreen navigation={navigation as any} onCloseDrawer={closeDrawer} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { flex: 1 },
    header: { height: 60, marginTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 },
    menuButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
    menuLine: { height: 2, width: 22, backgroundColor: AppColors.textPrimary, marginVertical: 3, borderRadius: 2 },
    backButton: { padding: 8 },
    backText: { color: AppColors.accentCyan, fontSize: 16, fontWeight: '600' },
    scrollView: { flex: 1 },
    page: { flex: 1, paddingHorizontal: 24 },
    pageCenter: { flex: 1, justifyContent: 'center' },
    middleSection: { flex: 1 },
    titleContainer: { alignItems: 'center', marginBottom: 40 },
    mainTitle: { fontSize: 36, fontWeight: '800', color: AppColors.textPrimary, letterSpacing: 1 },
    subTitle: { fontSize: 16, color: AppColors.textSecondary, marginTop: 8, textAlign: 'center' },

    // Search bar — two positions
    searchBarBottom: { width: '100%', elevation: 10, paddingHorizontal: 24, position: 'absolute', bottom: 60 },
    searchBarTop: { paddingHorizontal: 24, marginBottom: 16 },
    searchBarGradient: { borderRadius: 30, padding: 2 },
    searchContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppColors.primaryDark, borderRadius: 28, paddingLeft: 20, paddingRight: 6, height: 60 },
    searchIcon: { fontSize: 20, marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16, color: AppColors.textPrimary, height: '100%' },
    micButton: { height: 44, width: 44, borderRadius: 22, overflow: 'hidden' },
    micGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    micIcon: { fontSize: 20 },

    // Searching mode
    searchingContainer: { flex: 1, paddingTop: 8 },
    searchContentArea: { flex: 1, paddingHorizontal: 24 },
    resultsContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
    sectionHeader: { fontSize: 14, fontWeight: '700', color: AppColors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 },
    resultsList: { paddingBottom: 100 },
    resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppColors.surfaceCard + '80', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: AppColors.textMuted + '1A' },
    resultIconContainer: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: AppColors.primaryMid, marginRight: 14 },
    resultThumbnail: { width: '100%', height: '100%' },
    resultTextContainer: { flex: 1 },
    resultTitle: { fontSize: 14, fontWeight: '600', color: AppColors.textPrimary, lineHeight: 20 },
    resultSubtitle: { fontSize: 12, color: AppColors.accentCyan, marginTop: 4 },

    // Footer
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 40, gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AppColors.textMuted + '40' },
    activeDot: { width: 24, backgroundColor: AppColors.accentCyan },

    // Modal
    modalContainer: { flex: 1, backgroundColor: '#000' },
    modalHeader: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
    headerIcon: { color: '#FFF', fontSize: 24 },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    brainButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    modelBtn: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },

    // Custom Drawer Styles
    drawerOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 50,
    },
    drawerContainer: {
        position: 'absolute',
        top: 0, left: 0, bottom: 0,
        width: '85%',
        backgroundColor: AppColors.primaryDark,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
    },
    // ─── NEW GLASSMORPHISM AESTHETIC STYLES ────────────────────
    glassBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#05050A',
        overflow: 'hidden',
    },
    aurora1: {
        position: 'absolute',
        top: -100,
        left: -150,
        width: 800,
        height: 250,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        transform: [{ rotate: '45deg' }],
        borderRadius: 400,
    },
    aurora2: {
        position: 'absolute',
        bottom: -50,
        right: -250,
        width: 900,
        height: 300,
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        transform: [{ rotate: '-35deg' }],
        borderRadius: 450,
    },
    aurora3: {
        position: 'absolute',
        top: '30%',
        left: -200,
        width: 600,
        height: 200,
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        transform: [{ rotate: '70deg' }],
        borderRadius: 300,
    },
    glassHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: 20,
        height: 60,
        position: 'relative',
    },
    headerMenuButton: {
        position: 'absolute',
        left: 20,
        padding: 8,
        zIndex: 10,
    },
    headerCancelButton: {
        position: 'absolute',
        right: 20,
        padding: 8,
        zIndex: 10,
    },
    glassHeaderTitle: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    dashboardMiddleSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    indexingCard: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    middleVoidContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
        marginBottom: 24,
        width: '100%',
    },
    middleVoidText: {
        fontSize: 16,
        color: '#9CA3AF',
        marginBottom: 16,
    },
    suggestionRow: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    suggestionPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    suggestionText: {
        color: '#FFFFFF',
        fontSize: 14,
    },
    dashboardActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 12,
    },
    actionColumn: {
        flex: 1,
        alignItems: 'center',
    },
    solidButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dashboardButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    dashboardButtonSubtitle: {
        color: '#D1D5DB',
        fontSize: 12,
        marginTop: 6,
    },
    glassSearchBarContainer: {
        width: '100%',
        elevation: 10,
    },
    searchBarTopSearch: {
        marginBottom: 16,
    },
    searchBarBottomNormal: {
        marginTop: 20,
        marginBottom: 30,
    },
    glassSearchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#202123',
        borderRadius: 30,
        paddingLeft: 20,
        paddingRight: 6,
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    glassSearchInput: {
        flex: 1,
        fontSize: 16,
        color: '#FFFFFF',
        height: '100%',
    },
    glassMicButton: {
        height: 44,
        width: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    glassMicIcon: {
        fontSize: 18,
    },
    googleVoiceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        gap: 16,
    },
    voiceCircle: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    voiceStopButton: {
        position: 'absolute',
        right: 10,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voiceStopSquare: {
        width: 14,
        height: 14,
        backgroundColor: '#EF4444',
        borderRadius: 2,
    },
    loadingBoxContainer: {
        width: '100%',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0, 217, 255, 0.2)',
        overflow: 'hidden',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        ...Platform.select({
            ios: {
                shadowColor: '#00D9FF',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: { elevation: 10 },
        }),
    },
    loadingBox: {
        padding: 24,
    },
    loadingHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    loadingLoaderContainer: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingSpinner: {
        width: 30,
        height: 30,
        borderRadius: 15,
        overflow: 'hidden',
    },
    loadingSpinnerCenterMask: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
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
        fontSize: 14,
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
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 16,
    },
    loadingProgressTrack: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 16,
    },
    loadingProgressBar: {
        height: '100%',
        borderRadius: 3,
    },
    loadingFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    loadingPrivacyText: {
        color: '#00D9FF',
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
        opacity: 0.8,
    },

});