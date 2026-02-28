/**
 * 🔒 PRIVACY NOTICE
 * All counter-strategy logic runs locally on device.
 * No data leaves this device.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { DetectedPattern, CounterStrategy } from '../types/session';
import { generateCounterStrategies, resetAllCooldowns } from '../services/CounterStrategyEngine';

interface UseCounterStrategyReturn {
    /** The currently active counter-strategy to display, or null */
    activeStrategy: CounterStrategy | null;
    /** Dismiss the current strategy card */
    dismiss: () => void;
    /** Reset all cooldowns (e.g., on session start) */
    reset: () => void;
}

/**
 * Hook that processes detected patterns and produces counter-strategy suggestions.
 *
 * - Only triggers when confidence > threshold (default 70%)
 * - Applies 10-second cooldown per tactic
 * - Only updates UI when tactic actually changes (no flicker)
 *
 * @param detectedPatterns - Array of detected patterns from the live session
 * @param confidenceThreshold - Minimum confidence to trigger (default 70)
 */
export const useCounterStrategy = (
    detectedPatterns: DetectedPattern[],
    confidenceThreshold: number = 70,
): UseCounterStrategyReturn => {
    const [activeStrategy, setActiveStrategy] = useState<CounterStrategy | null>(null);
    const lastTacticRef = useRef<string | null>(null);
    const lastTimestampRef = useRef<number>(0);

    useEffect(() => {
        if (detectedPatterns.length === 0) return;

        // Get the highest-confidence pattern (array is sorted by confidence, highest first)
        const topPattern = detectedPatterns[0];

        if (!topPattern) return;

        console.log('[useCounterStrategy] 🔍 Evaluating top pattern:', topPattern.pattern, 'confidence:', topPattern.confidenceScore, 'id:', topPattern.id);

        // Skip if same pattern ID (exact same detection, prevents flicker)
        if (topPattern.id === lastTacticRef.current) {
            console.log('[useCounterStrategy] ⏭️ Same pattern ID, skipping');
            return;
        }

        // Try to generate counter-strategy (engine handles cooldown internally)
        const strategy = generateCounterStrategies(
            topPattern.pattern,
            topPattern.confidenceScore,
            10_000, // 10s cooldown
            confidenceThreshold,
        );

        if (strategy) {
            console.log('[useCounterStrategy] ✅ New counter-strategy:', strategy.tacticDisplayName);
            lastTacticRef.current = topPattern.id;
            lastTimestampRef.current = Date.now();
            setActiveStrategy(strategy);
        } else {
            console.log('[useCounterStrategy] ❌ No strategy generated (cooldown or below threshold)');
        }
    }, [detectedPatterns, detectedPatterns.length, confidenceThreshold]);

    const dismiss = useCallback(() => {
        setActiveStrategy(null);
        lastTacticRef.current = null;
    }, []);

    const reset = useCallback(() => {
        setActiveStrategy(null);
        lastTacticRef.current = null;
        lastTimestampRef.current = 0;
        resetAllCooldowns();
    }, []);

    return { activeStrategy, dismiss, reset };
};
