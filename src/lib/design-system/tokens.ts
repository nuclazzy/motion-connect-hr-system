/**
 * Motion Connect HR Design System - Design Tokens
 * Material Design 3 기반 디자인 토큰 정의
 */

// 색상 팔레트 (Material Design 3 기반)
export const colors = {
  // Primary Colors (회사 브랜드 컬러)
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe', 
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Main brand color
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49'
  },
  
  // Secondary Colors (보조 컬러)
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617'
  },
  
  // Semantic Colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d'
  },
  
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f'
  },
  
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d'
  },
  
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },
  
  // Neutral Colors
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a'
  }
} as const

// 타이포그래피 (Material Design Type Scale)
export const typography = {
  fontFamily: {
    sans: [
      'Pretendard Variable',
      'Pretendard', 
      '-apple-system',
      'BlinkMacSystemFont',
      'system-ui',
      'Roboto',
      'Helvetica Neue',
      'Segoe UI',
      'Apple SD Gothic Neo',
      'Noto Sans KR',
      'Malgun Gothic',
      'Apple Color Emoji',
      'Segoe UI Emoji',
      'Segoe UI Symbol',
      'sans-serif'
    ],
    mono: [
      'JetBrains Mono',
      'SF Mono',
      'Monaco',
      'Inconsolata',
      'Roboto Mono',
      'source-code-pro',
      'Menlo',
      'Consolas',
      'monospace'
    ]
  },
  
  fontSize: {
    'display-large': ['57px', { lineHeight: '64px', letterSpacing: '-0.25px' }],
    'display-medium': ['45px', { lineHeight: '52px', letterSpacing: '0px' }],
    'display-small': ['36px', { lineHeight: '44px', letterSpacing: '0px' }],
    
    'headline-large': ['32px', { lineHeight: '40px', letterSpacing: '0px' }],
    'headline-medium': ['28px', { lineHeight: '36px', letterSpacing: '0px' }],
    'headline-small': ['24px', { lineHeight: '32px', letterSpacing: '0px' }],
    
    'title-large': ['22px', { lineHeight: '28px', letterSpacing: '0px' }],
    'title-medium': ['16px', { lineHeight: '24px', letterSpacing: '0.15px' }],
    'title-small': ['14px', { lineHeight: '20px', letterSpacing: '0.1px' }],
    
    'body-large': ['16px', { lineHeight: '24px', letterSpacing: '0.5px' }],
    'body-medium': ['14px', { lineHeight: '20px', letterSpacing: '0.25px' }],
    'body-small': ['12px', { lineHeight: '16px', letterSpacing: '0.4px' }],
    
    'label-large': ['14px', { lineHeight: '20px', letterSpacing: '0.1px' }],
    'label-medium': ['12px', { lineHeight: '16px', letterSpacing: '0.5px' }],
    'label-small': ['11px', { lineHeight: '16px', letterSpacing: '0.5px' }]
  },
  
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    'semi-bold': '600',
    bold: '700'
  }
} as const

// 간격 시스템 (8px 기준)
export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px'
} as const

// 테두리 반지름 (Material Design Corner Radius)
export const borderRadius = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  full: '9999px'
} as const

// 그림자 (Material Design Elevation)
export const boxShadow = {
  none: 'none',
  xs: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
  sm: '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06)',
  md: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0px 2px 4px 0px rgba(0, 0, 0, 0.06)'
} as const

// 애니메이션 지속 시간 (Material Design Motion)
export const transitionDuration = {
  75: '75ms',
  100: '100ms',
  150: '150ms',
  200: '200ms',
  300: '300ms',
  500: '500ms',
  700: '700ms',
  1000: '1000ms'
} as const

// 애니메이션 이징 (Material Design Easing)
export const transitionTimingFunction = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Material Design Standard Easing
  'standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'standard-decelerate': 'cubic-bezier(0, 0, 0, 1)',
  'standard-accelerate': 'cubic-bezier(0.3, 0, 1, 1)',
  'emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
  'emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  'emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)'
} as const

// 브레이크포인트 (반응형 디자인)
export const breakpoints = {
  xs: '475px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
} as const

// Z-Index 스케일
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800
} as const

// 컴포넌트 특정 토큰
export const components = {
  button: {
    height: {
      sm: '32px',
      md: '40px',
      lg: '48px'
    },
    padding: {
      sm: { x: '12px', y: '6px' },
      md: { x: '16px', y: '8px' },
      lg: { x: '20px', y: '12px' }
    }
  },
  
  input: {
    height: {
      sm: '32px',
      md: '40px',
      lg: '48px'
    },
    padding: {
      sm: { x: '8px', y: '6px' },
      md: { x: '12px', y: '8px' },
      lg: { x: '16px', y: '12px' }
    }
  },
  
  card: {
    padding: {
      sm: '16px',
      md: '24px',
      lg: '32px'
    }
  }
} as const

// CSS 변수로 내보내기 위한 플랫 객체
export const cssVariables = {
  // Primary Colors
  '--color-primary-50': colors.primary[50],
  '--color-primary-100': colors.primary[100],
  '--color-primary-200': colors.primary[200],
  '--color-primary-300': colors.primary[300],
  '--color-primary-400': colors.primary[400],
  '--color-primary-500': colors.primary[500],
  '--color-primary-600': colors.primary[600],
  '--color-primary-700': colors.primary[700],
  '--color-primary-800': colors.primary[800],
  '--color-primary-900': colors.primary[900],
  '--color-primary-950': colors.primary[950],
  
  // Success Colors
  '--color-success-50': colors.success[50],
  '--color-success-500': colors.success[500],
  '--color-success-600': colors.success[600],
  '--color-success-700': colors.success[700],
  
  // Error Colors
  '--color-error-50': colors.error[50],
  '--color-error-500': colors.error[500],
  '--color-error-600': colors.error[600],
  '--color-error-700': colors.error[700],
  
  // Warning Colors
  '--color-warning-50': colors.warning[50],
  '--color-warning-500': colors.warning[500],
  '--color-warning-600': colors.warning[600],
  '--color-warning-700': colors.warning[700],
  
  // Neutral Colors
  '--color-neutral-0': colors.neutral[0],
  '--color-neutral-50': colors.neutral[50],
  '--color-neutral-100': colors.neutral[100],
  '--color-neutral-200': colors.neutral[200],
  '--color-neutral-300': colors.neutral[300],
  '--color-neutral-400': colors.neutral[400],
  '--color-neutral-500': colors.neutral[500],
  '--color-neutral-600': colors.neutral[600],
  '--color-neutral-700': colors.neutral[700],
  '--color-neutral-800': colors.neutral[800],
  '--color-neutral-900': colors.neutral[900],
  '--color-neutral-950': colors.neutral[950],
  
  // Spacing
  '--spacing-1': spacing[1],
  '--spacing-2': spacing[2],
  '--spacing-3': spacing[3],
  '--spacing-4': spacing[4],
  '--spacing-5': spacing[5],
  '--spacing-6': spacing[6],
  '--spacing-8': spacing[8],
  '--spacing-10': spacing[10],
  '--spacing-12': spacing[12],
  '--spacing-16': spacing[16],
  '--spacing-20': spacing[20],
  '--spacing-24': spacing[24],
  
  // Border Radius
  '--radius-xs': borderRadius.xs,
  '--radius-sm': borderRadius.sm,
  '--radius-md': borderRadius.md,
  '--radius-lg': borderRadius.lg,
  '--radius-xl': borderRadius.xl,
  '--radius-full': borderRadius.full,
  
  // Typography
  '--font-family-sans': typography.fontFamily.sans.join(', '),
  '--font-family-mono': typography.fontFamily.mono.join(', ')
} as const