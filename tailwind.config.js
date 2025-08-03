/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Colors from design tokens
      colors: {
        // Primary colors (디자인 토큰과 일치)
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe', 
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
          DEFAULT: '#0ea5e9',
        },
        
        // Secondary colors (디자인 토큰과 일치)
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
          950: '#020617',
          DEFAULT: '#64748b',
        },
        
        // Error colors (디자인 토큰과 일치)
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
          900: '#7f1d1d',
          DEFAULT: '#ef4444',
        },
        
        // Warning colors (디자인 토큰과 일치)
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
          900: '#78350f',
          DEFAULT: '#f59e0b',
        },
        
        // Success colors (디자인 토큰과 일치)
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
          900: '#14532d',
          DEFAULT: '#22c55e',
        },
        
        // Info colors (디자인 토큰과 일치)
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
          900: '#1e3a8a',
          DEFAULT: '#3b82f6',
        },
        
        // Neutral/Gray scale (디자인 토큰과 일치)
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
          950: '#0a0a0a',
          DEFAULT: '#737373',
        },
        
        // Surface colors
        surface: {
          primary: '#ffffff',
          secondary: '#f8f9fa',
          tertiary: '#f1f3f4',
          inverse: '#212121',
          variant: '#e3f2fd',
          DEFAULT: '#ffffff',
        },
        
        // Text colors
        text: {
          primary: '#212121',
          secondary: '#757575',
          disabled: '#bdbdbd',
          inverse: '#ffffff',
          hint: '#9e9e9e',
          DEFAULT: '#212121',
        },
        
        // Border colors
        border: {
          light: '#e0e0e0',
          medium: '#bdbdbd',
          dark: '#757575',
          focus: '#2196f3',
          error: '#f44336',
          success: '#4caf50',
          DEFAULT: '#e0e0e0',
        },
      },
      
      // Typography
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      
      fontSize: {
        // Display styles
        'display-large': ['57px', { lineHeight: '64px', letterSpacing: '-0.25px' }],
        'display-medium': ['45px', { lineHeight: '52px', letterSpacing: '0px' }],
        'display-small': ['36px', { lineHeight: '44px', letterSpacing: '0px' }],
        
        // Headline styles
        'headline-large': ['32px', { lineHeight: '40px', letterSpacing: '0px' }],
        'headline-medium': ['28px', { lineHeight: '36px', letterSpacing: '0px' }],
        'headline-small': ['24px', { lineHeight: '32px', letterSpacing: '0px' }],
        
        // Title styles
        'title-large': ['22px', { lineHeight: '28px', letterSpacing: '0px' }],
        'title-medium': ['16px', { lineHeight: '24px', letterSpacing: '0.15px' }],
        'title-small': ['14px', { lineHeight: '20px', letterSpacing: '0.1px' }],
        
        // Body styles
        'body-large': ['16px', { lineHeight: '24px', letterSpacing: '0.5px' }],
        'body-medium': ['14px', { lineHeight: '20px', letterSpacing: '0.25px' }],
        'body-small': ['12px', { lineHeight: '16px', letterSpacing: '0.4px' }],
        
        // Label styles
        'label-large': ['14px', { lineHeight: '20px', letterSpacing: '0.1px' }],
        'label-medium': ['12px', { lineHeight: '16px', letterSpacing: '0.5px' }],
        'label-small': ['11px', { lineHeight: '16px', letterSpacing: '0.5px' }],
      },
      
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      
      // Spacing (8px 기반 시스템)
      spacing: {
        0: '0',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px',
        32: '128px',
        40: '160px',
        48: '192px',
        56: '224px',
        64: '256px',
      },
      
      // Border radius
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        full: '9999px',
      },
      
      // Box shadow (elevation)
      boxShadow: {
        none: 'none',
        xs: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
        sm: '0px 1px 2px 0px rgba(0, 0, 0, 0.06), 0px 1px 3px 1px rgba(0, 0, 0, 0.1)',
        DEFAULT: '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
        md: '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
        lg: '0px 2px 3px 0px rgba(0, 0, 0, 0.1), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
        xl: '0px 4px 4px 0px rgba(0, 0, 0, 0.1), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
        
        // Elevation system
        'elevation-0': 'none',
        'elevation-1': '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
        'elevation-2': '0px 1px 2px 0px rgba(0, 0, 0, 0.06), 0px 1px 3px 1px rgba(0, 0, 0, 0.1)',
        'elevation-3': '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
        'elevation-4': '0px 2px 3px 0px rgba(0, 0, 0, 0.1), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
        'elevation-5': '0px 4px 4px 0px rgba(0, 0, 0, 0.1), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
      },
      
      // Animation and transitions
      transitionDuration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
      },
      
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        decelerated: 'cubic-bezier(0, 0, 0, 1)',
        accelerated: 'cubic-bezier(0.3, 0, 1, 1)',
      },
      
      // Z-index scale
      zIndex: {
        hide: '-1',
        auto: 'auto',
        base: '0',
        docked: '10',
        dropdown: '1000',
        sticky: '1100',
        banner: '1200',
        overlay: '1300',
        modal: '1400',
        popover: '1500',
        skipLink: '1600',
        toast: '1700',
        tooltip: '1800',
      },
      
      // Component sizes
      height: {
        'button-sm': '32px',
        'button-md': '40px',
        'button-lg': '48px',
        'input-sm': '32px',
        'input-md': '40px',
        'input-lg': '48px',
      },
      
      width: {
        'avatar-xs': '24px',
        'avatar-sm': '32px',
        'avatar-md': '40px',
        'avatar-lg': '48px',
        'avatar-xl': '64px',
        'avatar-2xl': '96px',
      },
      
      // Breakpoints (extending defaults)
      screens: {
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      
      // Custom animations
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'scale-out': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.9)' },
        },
        'slide-in-from-top': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-from-bottom': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-from-left': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-from-right': {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'shrink-width': {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
      },
      
      animation: {
        'fade-in': 'fade-in 300ms ease-out',
        'fade-out': 'fade-out 200ms ease-in',
        'scale-in': 'scale-in 300ms ease-out',
        'scale-out': 'scale-out 200ms ease-in',
        'slide-in-from-top': 'slide-in-from-top 300ms ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 300ms ease-out',
        'slide-in-from-left': 'slide-in-from-left 300ms ease-out',
        'slide-in-from-right': 'slide-in-from-right 300ms ease-out',
        'shrink-width': 'shrink-width 1s linear',
      },
    },
  },
  plugins: [
    // Custom plugin for design system utilities
    function({ addUtilities, addComponents, theme }) {
      // Screen reader only utility
      addUtilities({
        '.sr-only': {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        },
        '.not-sr-only': {
          position: 'static',
          width: 'auto',
          height: 'auto',
          padding: '0',
          margin: '0',
          overflow: 'visible',
          clip: 'auto',
          whiteSpace: 'normal',
        },
      });
      
      // Focus utilities
      addUtilities({
        '.focus-ring': {
          '&:focus': {
            outline: 'none',
            'box-shadow': `0 0 0 2px ${theme('colors.primary.500')}, 0 0 0 4px ${theme('colors.primary.100')}`,
          },
        },
        '.focus-ring-inset': {
          '&:focus': {
            outline: 'none',
            'box-shadow': `inset 0 0 0 2px ${theme('colors.primary.500')}`,
          },
        },
      });
      
      // Component utilities
      addComponents({
        '.btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: theme('fontWeight.medium'),
          border: '1px solid transparent',
          borderRadius: theme('borderRadius.lg'),
          transition: 'all 300ms ease-in-out',
          cursor: 'pointer',
          userSelect: 'none',
          '&:focus': {
            outline: 'none',
            boxShadow: `0 0 0 2px ${theme('colors.primary.500')}, 0 0 0 4px ${theme('colors.primary.100')}`,
          },
          '&:disabled': {
            cursor: 'not-allowed',
            opacity: '0.5',
          },
        },
        '.btn-primary': {
          backgroundColor: theme('colors.primary.500'),
          color: theme('colors.white'),
          borderColor: theme('colors.primary.500'),
          '&:hover:not(:disabled)': {
            backgroundColor: theme('colors.primary.600'),
            borderColor: theme('colors.primary.600'),
          },
          '&:active:not(:disabled)': {
            backgroundColor: theme('colors.primary.700'),
            borderColor: theme('colors.primary.700'),
          },
        },
        '.btn-secondary': {
          backgroundColor: 'transparent',
          color: theme('colors.primary.500'),
          borderColor: theme('colors.primary.500'),
          '&:hover:not(:disabled)': {
            backgroundColor: theme('colors.primary.50'),
            borderColor: theme('colors.primary.600'),
          },
          '&:active:not(:disabled)': {
            backgroundColor: theme('colors.primary.100'),
            borderColor: theme('colors.primary.700'),
          },
        },
        '.btn-sm': {
          height: theme('height.button-sm'),
          padding: '0 12px',
          fontSize: theme('fontSize.xs'),
          gap: theme('spacing.1'),
        },
        '.btn-md': {
          height: theme('height.button-md'),
          padding: '0 16px',
          fontSize: theme('fontSize.sm'),
          gap: theme('spacing.2'),
        },
        '.btn-lg': {
          height: theme('height.button-lg'),
          padding: '0 24px',
          fontSize: theme('fontSize.base'),
          gap: theme('spacing.2'),
        },
      });
      
      // Card components
      addComponents({
        '.card': {
          backgroundColor: theme('colors.surface.primary'),
          borderRadius: theme('borderRadius.lg'),
          border: `1px solid ${theme('colors.border.light')}`,
          boxShadow: theme('boxShadow.elevation-1'),
          transition: 'all 200ms ease-out',
        },
        '.card-elevated': {
          backgroundColor: theme('colors.surface.primary'),
          borderRadius: theme('borderRadius.lg'),
          border: 'none',
          boxShadow: theme('boxShadow.elevation-3'),
          '&:hover': {
            boxShadow: theme('boxShadow.elevation-4'),
          },
        },
        '.card-outlined': {
          backgroundColor: theme('colors.surface.primary'),
          borderRadius: theme('borderRadius.lg'),
          border: `1px solid ${theme('colors.border.medium')}`,
          boxShadow: 'none',
        },
      });
    },
  ],
};