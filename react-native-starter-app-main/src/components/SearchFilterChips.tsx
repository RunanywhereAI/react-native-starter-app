import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { AppColors } from '../theme';

export type FilterCategory = 'ALL' | 'IMAGE' | 'DOCUMENT';

interface SearchFilterChipsProps {
    selectedFilter: FilterCategory;
    onSelectFilter: (filter: FilterCategory) => void;
}

export const SearchFilterChips: React.FC<SearchFilterChipsProps> = ({
    selectedFilter,
    onSelectFilter,
}) => {
    const chips: { id: FilterCategory; label: string; icon: string }[] = [
        { id: 'ALL', label: 'All', icon: '🔍' },
        { id: 'IMAGE', label: 'Photos', icon: '📸' },
        { id: 'DOCUMENT', label: 'Documents', icon: '📄' },
    ];

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {chips.map((chip) => {
                    const isSelected = selectedFilter === chip.id;
                    return (
                        <TouchableOpacity
                            key={chip.id}
                            style={[
                                styles.chip,
                                isSelected && styles.chipSelected,
                            ]}
                            onPress={() => onSelectFilter(chip.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.chipIcon}>{chip.icon}</Text>
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                {chip.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 48,
        marginBottom: 8,
    },
    scrollContent: {
        paddingHorizontal: 20,
        alignItems: 'center',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    chipSelected: {
        backgroundColor: AppColors.accentCyan,
        borderColor: AppColors.primaryMid,
    },
    chipIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    chipText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: '#000000',
        fontWeight: 'bold',
    },
});
