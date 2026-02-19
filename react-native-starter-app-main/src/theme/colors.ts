/**
 * App color palette - Inspired by modern AI/tech aesthetics
 * Matching the Flutter app's beautiful theme
 */
export const AppColors = {
  // Primary gradient colors - Deep space with electric accents
  primaryDark: '#0A0E1A',
  primaryMid: '#141B2D',
  surfaceCard: '#1C2438',
  surfaceElevated: '#242F4A',

  // Accent colors - Electric cyan, violet, and more
  accentCyan: '#00D9FF',
  accentViolet: '#8B5CF6',
  accentPink: '#EC4899',
  accentGreen: '#10B981',
  accentOrange: '#F59E0B',

  // Text colors
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Status colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type AppColorsType = typeof AppColors;
