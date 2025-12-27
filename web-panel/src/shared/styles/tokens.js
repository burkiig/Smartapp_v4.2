/**
 * Design Tokens - Smart Attendance System
 * Modern, consistent design system
 */

export const tokens = {
    // Color Palette
    colors: {
        // Primary - Deep Navy
        primary: {
            50: '#F8FAFC',
            100: '#F1F5F9',
            200: '#E2E8F0',
            300: '#CBD5E1',
            400: '#94A3B8',
            500: '#64748B',
            600: '#475569',
            700: '#334155',
            800: '#1E293B',
            900: '#0F172A', // Deep Navy
        },

        // Accent - Vivid Purple
        accent: {
            50: '#FAF5FF',
            100: '#F3E8FF',
            200: '#E9D5FF',
            300: '#D8B4FE',
            400: '#C084FC',
            500: '#A855F7', // Vivid Purple
            600: '#9333EA',
            700: '#7C3AED',
            800: '#6B21A8',
            900: '#581C87',
        },

        // Semantic Colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',

        // Glassmorphism
        glass: {
            light: 'rgba(255, 255, 255, 0.1)',
            medium: 'rgba(255, 255, 255, 0.15)',
            dark: 'rgba(15, 23, 42, 0.5)',
            border: 'rgba(255, 255, 255, 0.1)',
        },

        // Gradients
        gradients: {
            primary: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            accent: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
            hero: 'linear-gradient(135deg, #0F172A 0%, #7C3AED 100%)',
            card: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
        }
    },

    // Typography
    typography: {
        fontFamily: {
            heading: "'Outfit', sans-serif",
            body: "'Inter', sans-serif",
            mono: "'Fira Code', monospace",
        },
        fontSize: {
            xs: '0.75rem',    // 12px
            sm: '0.875rem',   // 14px
            base: '1rem',     // 16px
            lg: '1.125rem',   // 18px
            xl: '1.25rem',    // 20px
            '2xl': '1.5rem',  // 24px
            '3xl': '1.875rem',// 30px
            '4xl': '2.25rem', // 36px
            '5xl': '3rem',    // 48px
        },
        fontWeight: {
            light: 300,
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
            extrabold: 800,
        },
        lineHeight: {
            tight: 1.25,
            normal: 1.5,
            relaxed: 1.75,
        }
    },

    // Spacing
    spacing: {
        0: '0',
        1: '0.25rem',   // 4px
        2: '0.5rem',    // 8px
        3: '0.75rem',   // 12px
        4: '1rem',      // 16px
        5: '1.25rem',   // 20px
        6: '1.5rem',    // 24px
        8: '2rem',      // 32px
        10: '2.5rem',   // 40px
        12: '3rem',     // 48px
        16: '4rem',     // 64px
        20: '5rem',     // 80px
        24: '6rem',     // 96px
    },

    // Border Radius
    borderRadius: {
        none: '0',
        sm: '0.375rem',   // 6px
        base: '0.5rem',   // 8px
        md: '0.75rem',    // 12px
        lg: '1rem',       // 16px
        xl: '1.5rem',     // 24px
        '2xl': '2rem',    // 32px
        full: '9999px',
    },

    // Shadows
    shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        glow: '0 0 20px rgba(168, 85, 247, 0.5)',
    },

    // Transitions
    transitions: {
        fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
        base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
        slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: '500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },

    // Z-index
    zIndex: {
        base: 0,
        dropdown: 1000,
        sticky: 1100,
        modal: 1200,
        popover: 1300,
        tooltip: 1400,
    }
};

// CSS Variables Export
export const cssVariables = `
  :root {
    /* Colors */
    --color-primary: ${tokens.colors.primary[900]};
    --color-accent: ${tokens.colors.accent[500]};
    --color-success: ${tokens.colors.success};
    --color-warning: ${tokens.colors.warning};
    --color-error: ${tokens.colors.error};
    
    /* Typography */
    --font-heading: ${tokens.typography.fontFamily.heading};
    --font-body: ${tokens.typography.fontFamily.body};
    
    /* Spacing */
    --spacing-base: ${tokens.spacing[4]};
    
    /* Border Radius */
    --radius-base: ${tokens.borderRadius.base};
    --radius-lg: ${tokens.borderRadius.lg};
    
    /* Transitions */
    --transition-base: ${tokens.transitions.base};
  }
`;
