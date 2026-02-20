import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, Dimensions, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme';
import { getRecentPhotos, clearRecentPhotos, RecentPhoto } from '../utils/RecentPhotos';

const { width } = Dimensions.get('window');
const GRID_GAP = 3;
const COLS = 3;
const TILE = (width - 48 - GRID_GAP * (COLS - 1)) / COLS; // fits 3 per row with side padding

interface Props {
    onSelectPhoto: (uri: string) => void;
}

export const RecentPhotosSlide: React.FC<Props> = ({ onSelectPhoto }) => {
    const [photos, setPhotos] = useState<RecentPhoto[]>([]);

    const load = useCallback(async () => {
        const recent = await getRecentPhotos();
        setPhotos(recent);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleClear = () => {
        Alert.alert('Clear History', 'Remove all recently viewed photos?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: async () => {
                    await clearRecentPhotos();
                    setPhotos([]);
                }
            },
        ]);
    };

    return (
        <LinearGradient colors={['#0D0D1A', '#0F0F2A', '#0D0D1A']} style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Recently Viewed</Text>
                    <Text style={styles.subtitle}>{photos.length} photos</Text>
                </View>
                {photos.length > 0 && (
                    <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                        <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                )}
            </View>

            {photos.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>🖼️</Text>
                    <Text style={styles.emptyTitle}>No Recent Photos</Text>
                    <Text style={styles.emptyHint}>Photos you view from search results will appear here</Text>
                </View>
            ) : (
                <FlatList
                    data={photos}
                    keyExtractor={item => item.uri}
                    numColumns={COLS}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.grid}
                    columnWrapperStyle={styles.row}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.tile}
                            onPress={() => onSelectPhoto(item.uri)}
                            activeOpacity={0.85}
                        >
                            <Image
                                source={{ uri: item.uri }}
                                style={styles.tileImage}
                                resizeMode="cover"
                            />
                            {/* Shimmer overlay */}
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.4)']}
                                style={styles.tileGrad}
                            />
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Swipe hint */}
            <View style={styles.swipeHint}>
                <Text style={styles.swipeHintText}>← Swipe left to search</Text>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    title: { color: '#FFF', fontSize: 26, fontWeight: '800' },
    subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
    clearBtn: {
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    clearText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
    grid: { paddingHorizontal: 24, paddingBottom: 120 },
    row: { gap: GRID_GAP, marginBottom: GRID_GAP },
    tile: {
        width: TILE, height: TILE,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: AppColors.surfaceCard,
    },
    tileImage: { width: '100%', height: '100%' },
    tileGrad: { ...StyleSheet.absoluteFillObject },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    emptyIcon: { fontSize: 52, marginBottom: 16 },
    emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    emptyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
    swipeHint: { alignItems: 'center', paddingBottom: 40 },
    swipeHintText: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
});
