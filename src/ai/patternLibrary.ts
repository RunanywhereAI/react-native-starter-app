/**
 * 🔒 PRIVACY NOTICE
 * All pattern detection runs locally on device.
 * No data leaves this device.
 */

import { NegotiationPattern, NegotiationMode, ModeConfig } from '../types/session';

/**
 * Pattern definition with structural detection rules
 */
export interface PatternDefinition {
  intent: NegotiationPattern;
  displayName: string;
  description: string;
  structuralPatterns: string[]; // Regex strings
  topicTags: string[]; // Context keywords
  requiresNumber: boolean; // Does it require numeric value like $50k or 60?
  negativeSignals: string[]; // Penalize score if present (e.g. "maybe")
  baseWeight: number; // Base confidence 0.0 - 1.0
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}

/**
 * Complete pattern library for negotiation detection using Structural Logic
 */
export const PATTERN_LIBRARY: Record<NegotiationPattern, PatternDefinition> = {
  [NegotiationPattern.ANCHORING]: {
    intent: NegotiationPattern.ANCHORING,
    displayName: 'Anchoring',
    description: 'Setting initial price/expectation reference point',
    structuralPatterns: [
      'we .* offer',
      'the .* range',
      'typically .* is',
      'industry standard',
      'expecting .* around',
      'base .* is',
      'looking .* for',
      'budget .* is',
    ],
    topicTags: ['salary', 'compensation', 'package', 'budget', 'price', 'cost', 'pay', 'base', 'range'],
    requiresNumber: true,
    negativeSignals: ['maybe', 'if possible', 'eventually'],
    baseWeight: 0.65,
    severity: 'high',
    suggestions: [
      'Ask for a detailed cost breakdown',
      'Present your own alternative anchor point',
      'Request comparison data from multiple sources',
    ],
  },

  [NegotiationPattern.BUDGET_OBJECTION]: {
    intent: NegotiationPattern.BUDGET_OBJECTION,
    displayName: 'Budget Objection',
    description: 'Claiming budget constraints or financial limitations',
    structuralPatterns: [
      'too expensive',
      'outside .* budget',
      'cost.* high',
      'we cannot afford',
      'beyond .* means',
      'budget is',
      'pricy',
      'not in .* budget',
      "don't have .* budget",
      'too much',
      'pricey',
    ],
    topicTags: ['money', 'budget', 'cost', 'expensive', 'price', 'afford', 'funds', 'capital'],
    requiresNumber: false,
    negativeSignals: ['flexible', 'might work', 'open to'],
    baseWeight: 0.70,
    severity: 'high',
    suggestions: [
      'Ask about budget flexibility and approval thresholds',
      'Break pricing into smaller phases or milestones',
      'Highlight ROI and value instead of focusing on cost',
    ],
  },

  [NegotiationPattern.AUTHORITY_PRESSURE]: {
    intent: NegotiationPattern.AUTHORITY_PRESSURE,
    displayName: 'Authority Pressure',
    description: 'Deferring to higher authority or claiming lack of decision power',
    structuralPatterns: [
      'as per policy',
      'management decided',
      'company standard',
      'HR guideline',
      'need .* approval',
      'check with .* boss',
      'run it by',
      'up to my manager',
      "don't have .* authority",
      'out of my hands',
    ],
    topicTags: ['manager', 'boss', 'approval', 'policy', 'guideline', 'hr', 'director', 'vp', 'board'],
    requiresNumber: false,
    negativeSignals: ['i decide', 'my call', 'we can do'],
    baseWeight: 0.75,
    severity: 'medium',
    suggestions: [
      'Ask for the specific decision criteria being used',
      'Suggest a joint review with all stakeholders',
      'Delay final commitment until decision-maker is present',
    ],
  },

  [NegotiationPattern.TIME_PRESSURE]: {
    intent: NegotiationPattern.TIME_PRESSURE,
    displayName: 'Time Pressure',
    description: 'Creating urgency or imposing deadlines',
    structuralPatterns: [
      'we need this today',
      'deadline is',
      'urgent decision',
      'limited time',
      'offer expires',
      'need this by',
      'as soon as possible',
      'right away',
      'move fast',
      'quickly',
      'by the end of',
    ],
    topicTags: ['today', 'tomorrow', 'urgent', 'deadline', 'asap', 'quickly', 'rush', 'speed', 'now'],
    requiresNumber: false,
    negativeSignals: ['no rush', 'take your time', 'whenever'],
    baseWeight: 0.65,
    severity: 'medium',
    suggestions: [
      'Ask if the deadline is truly final or flexible',
      'Introduce a new variable to reset the timeline',
      'Propose a pause — revisit with fresh perspective',
    ],
  },

  [NegotiationPattern.DEFLECTION]: {
    intent: NegotiationPattern.DEFLECTION,
    displayName: 'Deflection',
    description: 'Avoiding commitment or postponing decision via topic shift',
    structuralPatterns: [
      "let's focus on",
      "not the main issue",
      "get back to that",
      "right now .* discussing",
      "circle back",
      "talk about .* later",
      "park that",
      "take that offline",
      "moving on",
    ],
    topicTags: ['later', 'another time', 'focus', 'discussing', 'issue', 'offline', 'park'],
    requiresNumber: false,
    negativeSignals: ['i agree', 'let us decide now', 'perfect'],
    baseWeight: 0.60,
    severity: 'medium',
    suggestions: [
      'Pin down specific concerns driving the hesitation',
      'Set a concrete follow-up date and time right now',
      'Ask what information would help them decide today',
    ],
  },

  [NegotiationPattern.STRENGTH_SIGNAL]: {
    intent: NegotiationPattern.STRENGTH_SIGNAL,
    displayName: 'Strength Signal',
    description: 'Showcasing positive applicant background or achievements',
    structuralPatterns: [
      'led a team',
      'achieved',
      'improved .* by',
      'increased revenue',
      'managed .* projects',
      'successfully delivered',
      'spearheaded',
      'was responsible for',
      'top performer',
      'exceeded goals',
    ],
    topicTags: ['leadership', 'revenue', 'successful', 'achieved', 'driven', 'managed', 'delivered', 'exceeded', 'impact'],
    requiresNumber: false,
    negativeSignals: ['assisted', 'helped', 'was part of'],
    baseWeight: 0.70,
    severity: 'low',
    suggestions: [
      'Leverage this momentum to position yourself firmly',
      'Directly tie this achievement to their current needs',
      'Use this high-value moment to pivot to compensation framing',
    ],
  },

  [NegotiationPattern.POSITIVE_SIGNAL]: {
    intent: NegotiationPattern.POSITIVE_SIGNAL,
    displayName: 'Positive Signal',
    description: 'Expressions of interest, agreement, or enthusiasm',
    structuralPatterns: [
      'sounds good',
      'makes sense',
      'that works',
      'i like that',
      'great idea',
      'we agree',
      'we can do that',
      'looks perfect',
      'exactly right',
    ],
    topicTags: ['yes', 'agree', 'perfect', 'exactly', 'love', 'great', 'awesome', 'good'],
    requiresNumber: false,
    negativeSignals: ['however', 'but'],
    baseWeight: 0.80,
    severity: 'low',
    suggestions: [
      'Capitalize on momentum — move toward commitment',
      'Summarize agreed points and lock them in writing',
      'Ask about next steps while enthusiasm is high',
    ],
  },

  [NegotiationPattern.NEGATIVE_SIGNAL]: {
    intent: NegotiationPattern.NEGATIVE_SIGNAL,
    displayName: 'Negative Signal',
    description: 'Expressions of concern, disagreement, or rejection',
    structuralPatterns: [
      'not sure',
      'worried about',
      "don't think",
      'is a problem',
      'have concerns',
      'cannot work',
      'does not work',
      'impossible',
      'dealbreaker',
    ],
    topicTags: ['issue', 'problem', 'concerned', 'skeptical', 'worry', 'no', 'cannot', 'dealbreaker'],
    requiresNumber: false,
    negativeSignals: ['maybe', 'could work'],
    baseWeight: 0.75,
    severity: 'high',
    suggestions: [
      'Probe for the specific concern behind the negativity',
      'Acknowledge their worry and provide concrete evidence',
      'Offer an alternative approach that addresses the issue',
    ],
  },

  [NegotiationPattern.COMMITMENT_LANGUAGE]: {
    intent: NegotiationPattern.COMMITMENT_LANGUAGE,
    displayName: 'Commitment Language',
    description: 'Strong commitment or decision-making language',
    structuralPatterns: [
      "let's do it",
      'we are in',
      'ready to start',
      'sign the',
      'move forward',
      'go ahead',
      "let's proceed",
    ],
    topicTags: ['deal', 'agreed', 'commit', 'proceed', 'sign', 'forward', 'start'],
    requiresNumber: false,
    negativeSignals: ['maybe later', 'soon'],
    baseWeight: 0.85,
    severity: 'low',
    suggestions: [
      'Document the agreement immediately in writing',
      'Clarify all remaining terms before finalizing',
      'Confirm timeline and deliverables for next steps',
    ],
  }
};

/**
 * Filter Weights Arrays
 */
export interface ModeMatrix {
  highWeight: NegotiationPattern[];
  mediumWeight: NegotiationPattern[];
  lowWeight: NegotiationPattern[];
}

/**
 * Global Mode Intelligence Filter Matrix
 * Controls penalty / boost multipliers internally for IntentClassifier Context Check
 */
export const MODE_INTENT_MATRIX: Record<NegotiationMode, ModeMatrix> = {
  [NegotiationMode.SALARY_RAISE]: {
    highWeight: [NegotiationPattern.ANCHORING, NegotiationPattern.BUDGET_OBJECTION],
    mediumWeight: [NegotiationPattern.AUTHORITY_PRESSURE, NegotiationPattern.COMMITMENT_LANGUAGE],
    lowWeight: [NegotiationPattern.STRENGTH_SIGNAL, NegotiationPattern.DEFLECTION],
  },
  [NegotiationMode.JOB_INTERVIEW]: {
    highWeight: [NegotiationPattern.STRENGTH_SIGNAL, NegotiationPattern.DEFLECTION],
    mediumWeight: [NegotiationPattern.POSITIVE_SIGNAL, NegotiationPattern.TIME_PRESSURE],
    lowWeight: [NegotiationPattern.ANCHORING, NegotiationPattern.BUDGET_OBJECTION],
  },
  [NegotiationMode.STARTUP_PITCH]: {
    highWeight: [NegotiationPattern.BUDGET_OBJECTION, NegotiationPattern.DEFLECTION],
    mediumWeight: [NegotiationPattern.TIME_PRESSURE, NegotiationPattern.POSITIVE_SIGNAL],
    lowWeight: [NegotiationPattern.STRENGTH_SIGNAL],
  },
  [NegotiationMode.SALES]: {
    highWeight: [NegotiationPattern.BUDGET_OBJECTION, NegotiationPattern.TIME_PRESSURE, NegotiationPattern.COMMITMENT_LANGUAGE],
    mediumWeight: [NegotiationPattern.AUTHORITY_PRESSURE, NegotiationPattern.DEFLECTION],
    lowWeight: [NegotiationPattern.STRENGTH_SIGNAL],
  },
  [NegotiationMode.INVESTOR_MEETING]: {
    highWeight: [NegotiationPattern.DEFLECTION, NegotiationPattern.BUDGET_OBJECTION, NegotiationPattern.NEGATIVE_SIGNAL],
    mediumWeight: [NegotiationPattern.TIME_PRESSURE, NegotiationPattern.AUTHORITY_PRESSURE],
    lowWeight: [NegotiationPattern.STRENGTH_SIGNAL],
  },
  [NegotiationMode.CLIENT_NEGOTIATION]: {
    highWeight: [NegotiationPattern.ANCHORING, NegotiationPattern.BUDGET_OBJECTION, NegotiationPattern.TIME_PRESSURE],
    mediumWeight: [NegotiationPattern.AUTHORITY_PRESSURE, NegotiationPattern.DEFLECTION],
    lowWeight: [NegotiationPattern.STRENGTH_SIGNAL],
  },
  [NegotiationMode.CUSTOM_SCENARIO]: {
    highWeight: [NegotiationPattern.ANCHORING, NegotiationPattern.DEFLECTION, NegotiationPattern.NEGATIVE_SIGNAL],
    mediumWeight: [NegotiationPattern.TIME_PRESSURE, NegotiationPattern.BUDGET_OBJECTION],
    lowWeight: [NegotiationPattern.STRENGTH_SIGNAL],
  },
};

/**
 * Legacy interface for Type Compiling (to prevent UI from breaking).
 * Used generically to fetch icons and names but not used in the Universal NLP pipeline itself.
 */
export const MODE_CONFIGS: Record<NegotiationMode, ModeConfig> = {
  [NegotiationMode.JOB_INTERVIEW]: {
    mode: NegotiationMode.JOB_INTERVIEW,
    displayName: 'Job Interview',
    description: 'Optimize for employment negotiations and interview scenarios',
    icon: '💼',
    patternWeights: {} as any,
  },
  [NegotiationMode.SALES]: {
    mode: NegotiationMode.SALES,
    displayName: 'Sales',
    description: 'Optimize for sales conversations and client negotiations',
    icon: '💰',
    patternWeights: {} as any,
  },
  [NegotiationMode.STARTUP_PITCH]: {
    mode: NegotiationMode.STARTUP_PITCH,
    displayName: 'Startup Pitch',
    description: 'Optimize for investor pitches and funding negotiations',
    icon: '🚀',
    patternWeights: {} as any,
  },
  [NegotiationMode.SALARY_RAISE]: {
    mode: NegotiationMode.SALARY_RAISE,
    displayName: 'Salary Raise',
    description: 'Optimize for salary negotiation and raise discussions',
    icon: '📈',
    patternWeights: {} as any,
  },
  [NegotiationMode.INVESTOR_MEETING]: {
    mode: NegotiationMode.INVESTOR_MEETING,
    displayName: 'Investor Meeting',
    description: 'Optimize for venture capital and angel funding rounds',
    icon: '🏦',
    patternWeights: {} as any,
  },
  [NegotiationMode.CLIENT_NEGOTIATION]: {
    mode: NegotiationMode.CLIENT_NEGOTIATION,
    displayName: 'Client Negotiation',
    description: 'Optimize for contract, scoping, and B2B client delivery discussions',
    icon: '🤝',
    patternWeights: {} as any,
  },
  [NegotiationMode.CUSTOM_SCENARIO]: {
    mode: NegotiationMode.CUSTOM_SCENARIO,
    displayName: 'Custom Scenario',
    description: 'Optimize for unmapped, highly specific personal negotiations',
    icon: '🎯',
    patternWeights: {} as any,
  },
};

export const getAllPatterns = (): PatternDefinition[] => Object.values(PATTERN_LIBRARY);
export const getPatternDefinition = (pattern: NegotiationPattern): PatternDefinition => PATTERN_LIBRARY[pattern];
export const getModeConfig = (mode: NegotiationMode): ModeConfig => MODE_CONFIGS[mode];
export const getAllModes = (): ModeConfig[] => Object.values(MODE_CONFIGS);

export const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'just', 'right', 'okay', 'so', 'well', 'anyway'];
export const FILLER_WORD_PATTERN = new RegExp(`\\b(${FILLER_WORDS.join('|')})\\b`, 'gi');
