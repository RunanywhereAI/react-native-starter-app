import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { CounterStrategy } from '../types/session';
import { AppColors } from '../theme';

interface CounterStrategyCardProps {
    strategy: CounterStrategy;
    onDismiss?: () => void;
}

/**
 * CounterStrategyCard - Animated card displaying counter-strategy suggestions
 * when a negotiation tactic is detected with high confidence.
 */
export const CounterStrategyCard: React.FC<CounterStrategyCardProps> = ({
    strategy,
    onDismiss,
}) => {
    const slideAnim = useRef(new Animated.Value(120)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    useEffect(() => {
        // Reset animations for new strategy
        slideAnim.setValue(120);
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.95);

        // Animate in: slide up + fade in + scale up
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 60,
                friction: 9,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 60,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    }, [strategy.timestamp, slideAnim, fadeAnim, scaleAnim]);

    const getConfidenceColor = () => {
        if (strategy.confidence >= 85) return AppColors.error;
        if (strategy.confidence >= 70) return AppColors.warning;
        return AppColors.accentCyan;
    };

    const getGradientColors = (): string[] => {
        if (strategy.confidence >= 85) return ['#DC262620', '#0A0E1A'];
        if (strategy.confidence >= 70) return ['#F59E0B20', '#0A0E1A'];
        return ['#00D9FF20', '#0A0E1A'];
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                    opacity: fadeAnim,
                },
            ]}
        >
            <LinearGradient
                colors={getGradientColors()}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.gradient}
            >
                {/* Header: Tactic Name + Confidence Badge */}
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <View style={styles.tacticLabelContainer}>
                            <Text style={styles.warningIcon}>⚠️</Text>
                            <Text style={styles.tacticLabel}>Tactic Detected</Text>
                        </View>
                        <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor() + '30' }]}>
                            <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor() }]} />
                            <Text style={[styles.confidenceText, { color: getConfidenceColor() }]}>
                                {Math.round(strategy.confidence)}%
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.tacticName}>{strategy.tacticDisplayName}</Text>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Counter Suggestions */}
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsLabel}>🛡️ Counter Actions</Text>
                    {strategy.suggestions.map((suggestion, index) => (
                        <View key={index} style={styles.suggestionRow}>
                            <View style={styles.bulletDot} />
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                        </View>
                    ))}
                </View>

                {/* Explanation */}
                <View style={styles.explanationContainer}>
                    <Text style={styles.explanationText}>{strategy.explanation}</Text>
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: AppColors.accentViolet + '30',
    },
    gradient: {
        padding: 16,
    },
    header: {
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    tacticLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    warningIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    tacticLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: AppColors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    confidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    confidenceDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    confidenceText: {
        fontSize: 13,
        fontWeight: '700',
    },
    tacticName: {
        fontSize: 20,
        fontWeight: '800',
        color: AppColors.textPrimary,
        letterSpacing: 0.3,
    },
    divider: {
        height: 1,
        backgroundColor: AppColors.textMuted + '20',
        marginBottom: 12,
    },
    suggestionsContainer: {
        marginBottom: 12,
    },
    suggestionsLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: AppColors.accentCyan,
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
        paddingLeft: 4,
    },
    bulletDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: AppColors.accentViolet,
        marginTop: 7,
        marginRight: 10,
    },
    suggestionText: {
        fontSize: 14,
        color: AppColors.textPrimary,
        lineHeight: 20,
        flex: 1,
    },
    explanationContainer: {
        backgroundColor: AppColors.surfaceCard + 'AA',
        borderRadius: 10,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: AppColors.accentViolet + '80',
    },
    explanationText: {
        fontSize: 12,
        color: AppColors.textSecondary,
        lineHeight: 18,
        fontStyle: 'italic',
    },
});
