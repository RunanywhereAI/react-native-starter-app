/**
 * App color palette - Premium Light Purple Fintech Theme
 * Inspired by modern banking/fintech app design
 * Soft lavender backgrounds with purple accent cards
 */
export const AppColors = {
  // Backgrounds - Light lavender/purple
  primaryLight: '#F5F0FF',
  primaryBg: '#EDE5FF',
  primaryMid: '#E8DFFF',
  surfaceCard: '#FFFFFF',
  surfaceElevated: '#F8F5FF',

  // NOT USED for backward compat — mapped to new palette
  primaryDark: '#F5F0FF',

  // Purple gradient accent
  purpleGradientStart: '#7B61FF',
  purpleGradientEnd: '#9B82FF',
  purpleLight: '#C4B5FD',
  purpleMuted: '#DDD6FE',
  purpleSoft: '#EDE9FE',

  // Primary accent - Purple
  accentPrimary: '#7B61FF',
  accentSecondary: '#9B82FF',
  accentTeal: '#7B61FF', // backward compat alias
  accentTealLight: '#9B82FF',
  accentTealDark: '#6C4DE6',
  accentCyan: '#7B61FF', // backward compat
  accentViolet: '#6C4DE6',
  accentPink: '#F472B6',
  accentGreen: '#34C759',
  accentOrange: '#FF9F0A',

  // Text colors
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Status colors
  success: '#34C759',
  warning: '#FF9F0A',
  error: '#FF3B30',
  info: '#007AFF',

  // Transaction icon colors
  iconOrange: '#FF9F43',
  iconBlue: '#54A0FF',
  iconGreen: '#00D2D3',
  iconPurple: '#A29BFE',
  iconPink: '#FF6B6B',
  iconTeal: '#1DD1A1',

  // Glassmorphism / card styling
  glassBg: 'rgba(255, 255, 255, 0.7)',
  glassBgLight: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(123, 97, 255, 0.12)',
  glassBorderLight: 'rgba(123, 97, 255, 0.08)',

  // Shadow
  shadowPurple: '#7B61FF',
  shadowDark: 'rgba(0, 0, 0, 0.08)',
} as const;

export type AppColorsType = typeof AppColors;
