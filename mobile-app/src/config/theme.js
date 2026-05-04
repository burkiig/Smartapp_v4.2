/**
 * Smart Attendance — Mobile Design System
 * Single source of truth for all visual tokens.
 */

// ─── Color Palette ────────────────────────────────────────────────────────────
export const Colors = {
  // Primary — Blue (matches web panel)
  primary:       '#2563EB',
  primaryDark:   '#1D4ED8',
  primaryLight:  '#DBEAFE',
  primaryMuted:  '#EFF6FF',

  // Semantic
  success:       '#059669',
  successLight:  '#D1FAE5',
  successMuted:  '#ECFDF5',

  warning:       '#D97706',
  warningLight:  '#FEF3C7',
  warningMuted:  '#FFFBEB',

  error:         '#DC2626',
  errorLight:    '#FEE2E2',
  errorMuted:    '#FFF5F5',

  // Neutrals (Slate scale)
  text:          '#0F172A',   // headings
  textSecondary: '#475569',   // body
  textMuted:     '#94A3B8',   // placeholders, captions
  textInverse:   '#FFFFFF',

  border:        '#E2E8F0',
  borderLight:   '#F1F5F9',

  bg:            '#F1F5F9',   // screen background
  bgAlt:         '#F8FAFC',   // section background
  card:          '#FFFFFF',

  // Overlay / surface
  overlay:       'rgba(15,23,42,0.5)',
  shimmer:       'rgba(255,255,255,0.15)',
};

// ─── Gradients ────────────────────────────────────────────────────────────────
export const Gradients = {
  primary:   ['#2563EB', '#1D4ED8'],
  dark:      ['#0F172A', '#1E293B'],
  success:   ['#059669', '#047857'],
  warning:   ['#D97706', '#B45309'],
  error:     ['#DC2626', '#B91C1C'],
  hero:      ['#1E3A8A', '#2563EB'],
  subtle:    ['#F8FAFC', '#EFF6FF'],
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const Typography = {
  // Display
  d1: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  d2: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },

  // Headings
  h1: { fontSize: 24, fontWeight: '700', letterSpacing: -0.2 },
  h2: { fontSize: 20, fontWeight: '700' },
  h3: { fontSize: 18, fontWeight: '600' },
  h4: { fontSize: 16, fontWeight: '600' },

  // Body
  body:  { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyS: { fontSize: 14, fontWeight: '400', lineHeight: 20 },

  // UI
  label:   { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
  micro:   { fontSize: 11, fontWeight: '500' },
};

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  '2xl': 24,
  full: 9999,
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const Shadows = {
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
};
