import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Share,
  Linking,
  Platform,
  NativeModules,
  TouchableOpacity,
  FlatList,
} from "react-native";
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { getRecentPhotos, RecentPhoto } from '../utils/RecentPhotos';

// --- SVG Icons ---
const BackIcon = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);

const CloseIcon = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

const ScanIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
  </Svg>
);

const EditIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

const ShareIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
  </Svg>
);

// --- Constants ---
const { width, height } = Dimensions.get("window");
const CARD_SIZE = (width - 60) / 3;

const COLORS = {
  bgGradient: ["#0B0D15", "#121421"],
  accentPurple: "#4A3B6D",
  textMain: "#FFFFFF",
  textDim: "rgba(255, 255, 255, 0.6)",
  chipBg: "rgba(255, 255, 255, 0.1)",
  cardBg: "rgba(255, 255, 255, 0.05)",
};

type FilterType = "Today" | "Yesterday" | "Last Week";

export const GalleryScreen = () => {
  // 1. All hooks at the top
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState<FilterType>("Today");
  const [allPhotos, setAllPhotos] = useState<RecentPhoto[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    getRecentPhotos().then(setAllPhotos);
  }, []);

  const handleShare = useCallback(() => {
    if (!selectedImage) return;
    if (Platform.OS === 'android' && NativeModules.StorageModule?.shareImage) {
      NativeModules.StorageModule.shareImage(selectedImage.replace('file://', ''));
    } else {
      Share.share({ url: selectedImage });
    }
  }, [selectedImage]);

  const handleEdit = useCallback(() => {
    if (selectedImage) Linking.openURL(selectedImage);
  }, [selectedImage]);

  // 2. Logic helpers
  const getFilteredData = () => {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (activeFilter === 'Today') {
      return allPhotos.filter(p => p.viewedAt >= startOfToday);
    } else if (activeFilter === 'Yesterday') {
      return allPhotos.filter(p => p.viewedAt >= startOfToday - ONE_DAY && p.viewedAt < startOfToday);
    } else {
      return allPhotos.filter(p => p.viewedAt < startOfToday - ONE_DAY);
    }
  };

  const renderItem = ({ item }: { item: RecentPhoto }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => setSelectedImage(item.uri)}
    >
      <Image source={{ uri: item.uri }} style={styles.cardImage} resizeMode="cover" />
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={COLORS.bgGradient} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.title}>Gallery</Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {(["Today", "Yesterday", "Last Week"] as FilterType[]).map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => setActiveFilter(item)}
            style={[styles.filterChip, activeFilter === item && styles.activeChip]}
          >
            <Text style={[styles.filterText, activeFilter === item && styles.activeText]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Grid */}
      <FlatList
        data={getFilteredData()}
        renderItem={renderItem}
        keyExtractor={(item) => item.uri}
        numColumns={3}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recent scans found.</Text>
          </View>
        }
      />

      {/* Preview Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.iconButton}>
              <CloseIcon />
            </TouchableOpacity>

            <View style={styles.rightIcons}>
              <TouchableOpacity
                onPress={() => {
                  const uri = selectedImage;
                  setSelectedImage(null);
                  navigation.navigate('SmartClipboard', { scanUri: uri });
                }}
                style={styles.iconButton}
              >
                <ScanIcon />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleEdit} style={styles.iconButton}>
                <EditIcon />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
                <ShareIcon />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView centerContent contentContainerStyle={styles.scrollContainer} maximumZoomScale={5}>
            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
            )}
          </ScrollView>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  title: { color: COLORS.textMain, fontSize: 26, fontWeight: "700", marginLeft: 15 },
  filterRow: { flexDirection: "row", marginBottom: 25 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: COLORS.chipBg,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  activeChip: { backgroundColor: COLORS.accentPurple, borderColor: 'rgba(255,255,255,0.2)' },
  filterText: { color: COLORS.textDim, fontSize: 14, fontWeight: "500" },
  activeText: { color: COLORS.textMain, fontWeight: "600" },
  columnWrapper: { justifyContent: "flex-start", gap: 10 },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 16,
    backgroundColor: COLORS.cardBg,
    marginBottom: 10,
    overflow: 'hidden'
  },
  cardImage: { width: '100%', height: '100%' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textDim, fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalHeader: {
    position: 'absolute',
    top: 50,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10
  },
  rightIcons: { flexDirection: 'row', gap: 15 },
  iconButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },
  fullImage: { width: width, height: height * 0.8 },
});