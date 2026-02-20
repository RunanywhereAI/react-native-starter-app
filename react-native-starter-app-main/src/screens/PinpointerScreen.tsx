import React, { useRef, useEffect, useState } from 'react';
import { SyncProgressCard, ModelDownloadSheet, SearchHistoryPanel, RecentPhotosSlide } from '../components';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { addRecentPhoto } from '../utils/RecentPhotos';
import { DocumentRecord } from '../Database';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Animated,
    FlatList,
    Keyboard,
    Modal,
    Image,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme';
import { usePinpointer } from '../hooks/usePinpointer';

export const PinpointerScreen: React.FC = () => {
    const { width, height } = useWindowDimensions();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

    const {
        searchText, setSearchText,
        searchResults,
        isSearching, setIsSearching,
        selectedImage, setSelectedImage,
        isRecording, isTranscribing,
        startListening, stopListening,
        handleScan, handleShare, handleEdit,
        handleQuickSync, handleDeepSync, handlePauseSync, handleResumeSync,
        isSyncing, isPaused, isDeepSync, syncCount, totalImages,
        searchHistory, handleSelectHistory, handleDeleteHistory, handleClearHistory,
    } = usePinpointer();

    const [showModelSheet, setShowModelSheet] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const scrollViewRef = useRef<ScrollView>(null);
    const searchInputRef = useRef<TextInput>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        if (isSearching) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 20, duration: 300, useNativeDriver: true }),
            ]).start();
        }
    }, [isSearching]);

    const handleBackPress = () => {
        setIsSearching(false);
        setSearchText('');
        Keyboard.dismiss();
    };

    const handleSearchFocus = () => {
        setIsSearching(true);
    };

    const openImage = async (uri: string) => {
        setSelectedImage(uri);
        await addRecentPhoto(uri);
    };

    const renderResultItem = ({ item }: { item: DocumentRecord }) => (
        <TouchableOpacity
            style={styles.resultItem}
            onPress={() => openImage(item.filePath)}
            accessibilityLabel={`View image: ${item.content?.substring(0, 40)}`}
            accessibilityRole="button"
        >
            {/* Thumbnail */}
            <View style={styles.resultIconContainer}>
                <Image
                    source={{ uri: item.filePath }}
                    style={styles.resultThumbnail}
                    resizeMode="cover"
                />
            </View>
            <View style={styles.resultTextContainer}>
                <Text style={styles.resultTitle} numberOfLines={2}>{item.content}</Text>
                <Text style={styles.resultSubtitle}>
                    {item.detection_type === 'OBJECT' ? '🏷 Object' : '📝 Text'} • Tap to view
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

    // ─── Search Bar Component (reused in both states) ────────────────────
    const renderSearchBar = () => (
        <View style={isSearching ? styles.searchBarTop : styles.searchBarBottom}>
            <LinearGradient
                colors={[AppColors.surfaceCard, AppColors.surfaceElevated]}
                style={styles.searchBarGradient}
            >
                <View style={styles.searchContent}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        ref={searchInputRef}
                        style={styles.searchInput}
                        placeholder={isTranscribing ? "Transcribing..." : "Search documents..."}
                        placeholderTextColor={AppColors.textMuted}
                        value={searchText}
                        onChangeText={setSearchText}
                        onFocus={handleSearchFocus}
                        autoFocus={isSearching}
                        accessibilityLabel="Search documents"
                    />

                    {/* WHISPER MICROPHONE */}
                    <TouchableOpacity
                        style={styles.micButton}
                        onPress={isRecording ? stopListening : startListening}
                        disabled={isTranscribing}
                        accessibilityLabel={isRecording ? "Stop recording" : "Start voice search"}
                        accessibilityRole="button"
                    >
                        <LinearGradient
                            colors={
                                isTranscribing
                                    ? ['#888', '#555']
                                    : isRecording
                                        ? ['#FF416C', '#FF4B2B']
                                        : [AppColors.accentCyan, AppColors.accentViolet]
                            }
                            style={styles.micGradient}
                        >
                            <Text style={styles.micIcon}>
                                {isTranscribing ? '⏳' : isRecording ? '⏹️' : '🎤'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* BYPASS SCAN CAMERA */}
                    <TouchableOpacity
                        style={[styles.micButton, { marginLeft: 8 }]}
                        onPress={handleScan}
                        accessibilityLabel="Scan photo with camera"
                        accessibilityRole="button"
                    >
                        <LinearGradient
                            colors={[AppColors.primaryMid, AppColors.primaryDark]}
                            style={styles.micGradient}
                        >
                            <Text style={styles.micIcon}>📷</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[AppColors.primaryDark, AppColors.primaryMid, AppColors.primaryDark]}
                style={styles.background}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => navigation.navigate('Home')}
                        accessibilityLabel="Open menu"
                        accessibilityRole="button"
                    >
                        <View style={styles.menuLine} />
                        <View style={[styles.menuLine, { width: 14 }]} />
                        <View style={styles.menuLine} />
                    </TouchableOpacity>
                    {isSearching && (
                        <TouchableOpacity
                            onPress={handleBackPress}
                            style={styles.backButton}
                            accessibilityLabel="Cancel search"
                            accessibilityRole="button"
                        >
                            <Text style={styles.backText}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ────── SEARCHING MODE ────── */}
                {isSearching ? (
                    <View style={styles.searchingContainer}>
                        {/* Search bar pinned at top */}
                        {renderSearchBar()}

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
                                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                                ]}
                            >
                                <Text style={styles.sectionHeader}>Found in Images</Text>
                                <FlatList
                                    data={searchResults}
                                    renderItem={renderResultItem}
                                    keyExtractor={(item) => item.filePath || String(item.id)}
                                    contentContainerStyle={styles.resultsList}
                                    showsVerticalScrollIndicator={false}
                                    ListEmptyComponent={
                                        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                                            <Text style={styles.subTitle}>No matches found.</Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>
                                                Not in the last 300 photos?
                                            </Text>
                                            <TouchableOpacity
                                                onPress={handleDeepSync}
                                                style={{
                                                    marginTop: 12,
                                                    backgroundColor: 'rgba(138,43,226,0.3)',
                                                    paddingHorizontal: 20,
                                                    paddingVertical: 10,
                                                    borderRadius: 20,
                                                    borderWidth: 1,
                                                    borderColor: 'rgba(138,43,226,0.6)',
                                                }}
                                                accessibilityLabel="Deep sync entire gallery"
                                                accessibilityRole="button"
                                            >
                                                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>
                                                    🔎 Deep Sync entire gallery
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    }
                                />
                            </Animated.View>
                        )}
                    </View>
                ) : (
                    /* ────── NORMAL MODE (Pages) ────── */
                    <>
                        <View style={styles.middleSection}>
                            <ScrollView
                                ref={scrollViewRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={handleScroll}
                                scrollEventThrottle={16}
                                contentOffset={{ x: width, y: 0 }}
                                style={styles.scrollView}
                            >
                                {/* PAGE 0: RECENT PHOTOS */}
                                <View style={[styles.page, { width }]}>
                                    <RecentPhotosSlide onSelectPhoto={openImage} />
                                </View>

                                {/* PAGE 1: SEARCH & SYNC */}
                                <View style={[styles.page, { width }]}>
                                    <View style={styles.pageCenter}>
                                        <View style={styles.titleContainer}>
                                            <TouchableOpacity
                                                onPress={() => setShowModelSheet(true)}
                                                style={styles.brainButton}
                                                accessibilityLabel="Open AI model settings"
                                                accessibilityRole="button"
                                            >
                                                <Text style={styles.mainTitle}>Bypass</Text>
                                                <View style={styles.modelBtn}>
                                                    <Text style={{ fontSize: 18 }}>🧠</Text>
                                                </View>
                                            </TouchableOpacity>
                                            <Text style={styles.subTitle}>Visual Intelligence Engine</Text>
                                        </View>

                                        {/* SYNC CARD */}
                                        <SyncProgressCard
                                            isSyncing={isSyncing}
                                            isPaused={isPaused}
                                            isDeepSync={isDeepSync}
                                            syncCount={syncCount}
                                            totalImages={totalImages}
                                            onQuickSync={handleQuickSync}
                                            onDeepSync={handleDeepSync}
                                            onPauseSync={handlePauseSync}
                                            onResumeSync={handleResumeSync}
                                        />
                                    </View>
                                </View>

                                {/* PAGE 2: EXTRA (Placeholder) */}
                                <View style={[styles.page, { width }]}>
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>More settings coming soon</Text>
                                    </View>
                                </View>
                            </ScrollView>

                            {/* Search Bar — floating above dots */}
                            {currentPage === 1 && renderSearchBar()}
                        </View>

                        <View style={styles.footer}>
                            <View style={[styles.dot, currentPage === 0 && styles.activeDot]} />
                            <View style={[styles.dot, currentPage === 1 && styles.activeDot]} />
                            <View style={[styles.dot, currentPage === 2 && styles.activeDot]} />
                        </View>
                    </>
                )}
            </LinearGradient>

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
});