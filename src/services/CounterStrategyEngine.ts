/**
 * 🔒 PRIVACY NOTICE
 * All counter-strategy generation runs locally on device.
 * No data leaves this device. No cloud APIs. No LLM calls.
 * Pure rule-based mapping from detected tactics to counter-strategies.
 */

import { NegotiationPattern, CounterStrategy } from '../types/session';
import { getPatternDefinition } from '../ai/patternLibrary';

/**
 * Counter strategy definition for each tactic
 */
interface CounterStrategyDefinition {
    suggestions: string[];
    explanation: string;
}

/**
 * Complete rule-based mapping: tactic → counter-strategies
 */
const COUNTER_STRATEGY_MAP: Record<NegotiationPattern, CounterStrategyDefinition> = {
    [NegotiationPattern.ANCHORING]: {
        suggestions: [
            'Ask for a detailed cost breakdown',
            'Present your own alternative anchor point',
            'Request comparison data from multiple sources',
        ],
        explanation:
            'Anchoring attempts to set a psychological reference point. Counter by introducing your own data-backed reference or questioning their basis.',
    },

    [NegotiationPattern.BUDGET_OBJECTION]: {
        suggestions: [
            'Ask about budget flexibility and approval thresholds',
            'Break pricing into smaller phases or milestones',
            'Highlight ROI and value instead of focusing on cost',
        ],
        explanation:
            'Budget objection often masks value hesitation rather than a real constraint. Shift the conversation from cost to return on investment.',
    },

    [NegotiationPattern.AUTHORITY_PRESSURE]: {
        suggestions: [
            'Ask for the specific decision criteria being used',
            'Suggest a joint review with all stakeholders',
            'Delay final commitment until decision-maker is present',
        ],
        explanation:
            'Authority pressure reduces your negotiation space by introducing an unseen decision-maker. Get access to the real authority.',
    },

    [NegotiationPattern.TIME_PRESSURE]: {
        suggestions: [
            'Ask if the deadline is truly final or flexible',
            'Introduce a new variable to reset the timeline',
            'Propose a pause — revisit with fresh perspective',
        ],
        explanation:
            'Urgency framing creates artificial pressure to force quick decisions. Verify the deadline and resist rushing critical commitments.',
    },

    [NegotiationPattern.DEFLECTION]: {
        suggestions: [
            'Pin down specific concerns driving the hesitation',
            'Set a concrete follow-up date and time right now',
            'Ask what information would help them decide today',
        ],
        explanation:
            'Deflection delays decisions without surfacing real objections. Gently identify what\'s actually holding them back.',
    },

    [NegotiationPattern.POSITIVE_SIGNAL]: {
        suggestions: [
            'Capitalize on momentum — move toward commitment',
            'Summarize agreed points and lock them in writing',
            'Ask about next steps while enthusiasm is high',
        ],
        explanation:
            'Positive signals indicate openness. Strike while the iron is hot — clarify terms and advance toward agreement.',
    },

    [NegotiationPattern.NEGATIVE_SIGNAL]: {
        suggestions: [
            'Probe for the specific concern behind the negativity',
            'Acknowledge their worry and provide concrete evidence',
            'Offer an alternative approach that addresses the issue',
        ],
        explanation:
            'Negative signals reveal underlying objections. Address them directly with empathy and data rather than ignoring them.',
    },

    [NegotiationPattern.COMMITMENT_LANGUAGE]: {
        suggestions: [
            'Document the agreement immediately in writing',
            'Clarify all remaining terms before finalizing',
            'Confirm timeline and deliverables for next steps',
        ],
        explanation:
            'Commitment language signals readiness to close. Ensure all details are clear and get confirmation in writing.',
    },
};

/**
 * Cooldown tracker — stores last trigger timestamp per tactic
 */
const cooldownTracker: Map<NegotiationPattern, number> = new Map();

/**
 * Default cooldown period in milliseconds (10 seconds)
 */
const COOLDOWN_MS = 10_000;

/**
 * Default confidence threshold (70%)
 */
const CONFIDENCE_THRESHOLD = 70;

/**
 * Generate counter-strategies for a detected tactic.
 *
 * Returns null if:
 * - Confidence is below threshold
 * - Same tactic was triggered within cooldown period
 *
 * @param tactic - The detected NegotiationPattern
 * @param confidence - Confidence score (0-100)
 * @param cooldownMs - Optional custom cooldown in ms (default: 10000)
 * @param threshold - Optional custom confidence threshold (default: 70)
 */
export const generateCounterStrategies = (
    tactic: NegotiationPattern,
    confidence: number,
    cooldownMs: number = COOLDOWN_MS,
    threshold: number = CONFIDENCE_THRESHOLD,
): CounterStrategy | null => {
    console.log('[CounterStrategyEngine] 🎯 generateCounterStrategies() called');
    console.log('[CounterStrategyEngine] 📋 Tactic:', tactic);
    console.log('[CounterStrategyEngine] 📊 Confidence:', confidence);

    // 1. Check confidence threshold
    if (confidence < threshold) {
        console.log(
            `[CounterStrategyEngine] ❌ Confidence ${confidence}% below threshold ${threshold}%`,
        );
        return null;
    }

    // 2. Check cooldown
    const now = Date.now();
    const lastTriggered = cooldownTracker.get(tactic);

    if (lastTriggered && now - lastTriggered < cooldownMs) {
        const remaining = Math.round((cooldownMs - (now - lastTriggered)) / 1000);
        console.log(
            `[CounterStrategyEngine] ⏳ Cooldown active for "${tactic}" — ${remaining}s remaining`,
        );
        return null;
    }

    // 3. Look up counter-strategy
    const definition = COUNTER_STRATEGY_MAP[tactic];

    if (!definition) {
        console.log(`[CounterStrategyEngine] ❌ No counter-strategy for tactic: ${tactic}`);
        return null;
    }

    // 4. Get display name from pattern library
    const patternDef = getPatternDefinition(tactic);

    // 5. Update cooldown tracker
    cooldownTracker.set(tactic, now);
    console.log(`[CounterStrategyEngine] ✅ Counter-strategy generated for "${tactic}"`);

    return {
        tactic,
        tacticDisplayName: patternDef.displayName,
        confidence,
        suggestions: definition.suggestions,
        explanation: definition.explanation,
        timestamp: now,
    };
};

/**
 * Reset cooldown for a specific tactic (for testing)
 */
export const resetCooldown = (tactic: NegotiationPattern): void => {
    cooldownTracker.delete(tactic);
};

/**
 * Reset all cooldowns (for testing or session reset)
 */
export const resetAllCooldowns = (): void => {
    cooldownTracker.clear();
};

/**
 * Check if a tactic is currently on cooldown
 */
export const isOnCooldown = (
    tactic: NegotiationPattern,
    cooldownMs: number = COOLDOWN_MS,
): boolean => {
    const lastTriggered = cooldownTracker.get(tactic);
    if (!lastTriggered) return false;
    return Date.now() - lastTriggered < cooldownMs;
};
