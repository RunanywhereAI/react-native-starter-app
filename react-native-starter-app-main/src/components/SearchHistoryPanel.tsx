import React from 'react';
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppColors } from '../theme';
import { SearchHistoryItem, formatSearchTime } from '../utils/SearchHistory';

interface Props {
    history: SearchHistoryItem[];
    onSelect: (query: string) => void;
    onDelete: (query: string) => void;
    onClearAll: () => void;
}

export const SearchHistoryPanel: React.FC<Props> = ({
    history, onSelect, onDelete, onClearAll,
}) => {
    if (history.length === 0) {
        return (
            <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>No search history yet</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>🕘 Recent Searches</Text>
                <TouchableOpacity onPress={onClearAll}>
                    <Text style={styles.clearAll}>Clear all</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={history}
                keyExtractor={item => item.query}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => onSelect(item.query)}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
                            style={styles.rowInner}
                        >
                            {/* Left: query */}
                            <View style={styles.rowLeft}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.queryText} numberOfLines={1}>
                                        {item.query}
                                    </Text>
                                    <Text style={styles.metaText}>
                                        {formatSearchTime(item.timestamp)}
                                        {item.resultCount > 0
                                            ? ` · ${item.resultCount} result${item.resultCount !== 1 ? 's' : ''}`
                                            : ' · no results'}
                                    </Text>
                                </View>
                            </View>

                            {/* Right: delete */}
                            <View style={styles.rowActions}>
                                <TouchableOpacity
                                    onPress={() => onDelete(item.query)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={styles.deleteBtn}
                                >
                                    <Text style={styles.deleteIcon}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginTop: 16 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        color: AppColors.textMuted,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    clearAll: {
        color: AppColors.accentCyan,
        fontSize: 12,
        fontWeight: '600',
    },
    row: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    rowInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    rowLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    queryText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    metaText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        marginTop: 2,
    },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    deleteBtn: {
        padding: 4,
    },
    deleteIcon: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 13,
    },
    separator: { height: 6 },
    emptyWrap: { alignItems: 'center', paddingVertical: 32 },
    emptyIcon: { fontSize: 32, marginBottom: 10 },
    emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },
});

