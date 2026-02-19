import React, { useRef, useEffect } from 'react';
import { SyncProgressCard } from '../components/SyncProgressCard';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Dimensions,
    Animated,
    FlatList,
    Keyboard,
    Modal,
    Image,
    ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme';
import { usePinpointer } from '../hooks/usePinpointer'; // <--- Connected to your Bypass Brain

const { width, height } = Dimensions.get('window');

export const PinpointerScreen: React.FC = () => {
    // --- PLUGGING IN THE STABLE BRAIN ---
    const { 
        searchText, setSearchText, 
        searchResults, 
        isSearching, setIsSearching,
        selectedImage, setSelectedImage,
        isRecording, isTranscribing, // STT States
        startListening, stopListening, 
        handleScan, handleShare, handleEdit,
        handleFullSync, isSyncing, syncCount, totalImages // <--- Sync Wires Added
    } = usePinpointer();

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

    const renderResultItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={styles.resultItem} 
            onPress={() => setSelectedImage(item.filePath)}
        >
            <View style={styles.resultIconContainer}>
                <Text style={styles.resultIcon}>📄</Text>
            </View>
            <View style={styles.resultTextContainer}>
                <Text style={styles.resultTitle}>{item.content}</Text>
                <Text style={styles.resultSubtitle}>Matched Result • Tap to view</Text>
            </View>
        </TouchableOpacity>
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
                    <TouchableOpacity style={styles.menuButton}>
                        <View style={styles.menuLine} />
                        <View style={[styles.menuLine, { width: 14 }]} />
                        <View style={styles.menuLine} />
                    </TouchableOpacity>
                    {isSearching && (
                        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                            <Text style={styles.backText}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Middle Section */}
                <Animated.View
                    style={[
                        styles.middleSection,
                        { transform: [{ translateY: isSearching ? -height * 0.15 : 0 }] }
                    ]}
                >
                    {!isSearching && (
                        <>
                            <View style={styles.titleContainer}>
                                <Text style={styles.mainTitle}>Pinpointer</Text>
                                <Text style={styles.subTitle}>On-Device AI Search</Text>
                            </View>

                            {/* --- ADDED SYNC CARD HERE --- */}
                            <SyncProgressCard 
                                isSyncing={isSyncing}
                                syncCount={syncCount}
                                totalImages={totalImages}
                                onStartSync={handleFullSync}
                            />
                        </>
                    )}
              

                    {/* Search Bar */}
                    <View style={styles.searchBarContainer}>
                        <LinearGradient
                            colors={[AppColors.surfaceCard, AppColors.surfaceElevated]}
                            style={styles.searchBarGradient}
                        >
                            <View style={styles.searchContent}>
                                <Text style={styles.searchIcon}>🔍</Text>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder={isTranscribing ? "Transcribing..." : "Search documents..."}
                                    placeholderTextColor={AppColors.textMuted}
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    onFocus={() => setIsSearching(true)}
                                />
                                
                                {/* WHISPER MICROPHONE */}
                                <TouchableOpacity 
                                    style={styles.micButton} 
                                    onPressIn={startListening}
                                    onPressOut={stopListening}
                                >
                                    <LinearGradient 
                                        colors={isRecording ? ['#FF416C', '#FF4B2B'] : [AppColors.accentCyan, AppColors.accentViolet]} 
                                        style={styles.micGradient}
                                    >
                                        <Text style={styles.micIcon}>{isRecording ? "🎙️" : "🎤"}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* BYPASS SCAN CAMERA */}
                                <TouchableOpacity 
                                    style={[styles.micButton, { marginLeft: 8 }]} 
                                    onPress={handleScan}
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

                    {/* Results Section */}
                    {isSearching && (
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
                                keyExtractor={(item, index) => index.toString()}
                                contentContainerStyle={styles.resultsList}
                                showsVerticalScrollIndicator={false}
                                ListEmptyComponent={
                                    <Text style={styles.subTitle}>No matches found.</Text>
                                }
                            />
                        </Animated.View>
                    )}
                </Animated.View>

                {!isSearching && (
                    <View style={styles.footer}>
                        <View style={styles.dot} />
                        <View style={[styles.dot, styles.activeDot]} />
                        <View style={styles.dot} />
                    </View>
                )}
            </LinearGradient>

            {/* GALLERY PREVIEW MODAL */}
            <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedImage(null)}><Text style={styles.headerIcon}>✕</Text></TouchableOpacity>
                        <View style={{flexDirection: 'row'}}>
                            <TouchableOpacity onPress={handleEdit} style={{marginRight: 25}}><Text style={styles.headerIcon}>✏️</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleShare}><Text style={styles.headerIcon}>📤</Text></TouchableOpacity>
                        </View>
                    </View>
                    <ScrollView maximumZoomScale={5} contentContainerStyle={styles.scrollContainer}>
                        {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullScreenImage} resizeMode="contain" />}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

// ... styles remain the same ...
const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { flex: 1, paddingHorizontal: 24 },
    header: { height: 60, marginTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    menuButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
    menuLine: { height: 2, width: 22, backgroundColor: AppColors.textPrimary, marginVertical: 3, borderRadius: 2 },
    backButton: { padding: 8 },
    backText: { color: AppColors.accentCyan, fontSize: 16, fontWeight: '600' },
    middleSection: { flex: 1, justifyContent: 'center' },
    titleContainer: { alignItems: 'center', marginBottom: 40 },
    mainTitle: { fontSize: 36, fontWeight: '800', color: AppColors.textPrimary, letterSpacing: 1 },
    subTitle: { fontSize: 16, color: AppColors.textSecondary, marginTop: 8, textAlign: 'center' },
    searchBarContainer: { width: '100%', elevation: 10 },
    searchBarGradient: { borderRadius: 30, padding: 2 },
    searchContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppColors.primaryDark, borderRadius: 28, paddingLeft: 20, paddingRight: 6, height: 60 },
    searchIcon: { fontSize: 20, marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16, color: AppColors.textPrimary, height: '100%' },
    micButton: { height: 44, width: 44, borderRadius: 22, overflow: 'hidden' },
    micGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    micIcon: { fontSize: 20 },
    resultsContainer: { marginTop: 40, flex: 1 },
    sectionHeader: { fontSize: 14, fontWeight: '700', color: AppColors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 },
    resultsList: { paddingBottom: 100 },
    resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppColors.surfaceCard + '80', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: AppColors.textMuted + '1A' },
    resultIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: AppColors.primaryMid, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    resultIcon: { fontSize: 24 },
    resultTextContainer: { flex: 1 },
    resultTitle: { fontSize: 16, fontWeight: '600', color: AppColors.textPrimary },
    resultSubtitle: { fontSize: 12, color: AppColors.accentCyan, marginTop: 2 },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 40, gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AppColors.textMuted + '40' },
    activeDot: { width: 24, backgroundColor: AppColors.accentCyan },
    modalContainer: { flex: 1, backgroundColor: '#000' },
    modalHeader: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
    headerIcon: { color: '#FFF', fontSize: 24 },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    fullScreenImage: { width: width, height: height * 0.8 },
});