import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1440px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          soft: 'hsl(var(--foreground-soft))',
        },
        'input-hover': 'hsl(var(--input-hover))',
        'input-foreground': 'hsl(var(--input-foreground))',
        placeholder: 'hsl(var(--placeholder))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          border: 'hsl(var(--sidebar-border))',
          active: 'hsl(var(--sidebar-active))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        status: {
          neutral: 'hsl(var(--status-neutral))',
          info: 'hsl(var(--status-info))',
          progress: 'hsl(var(--status-progress))',
          success: 'hsl(var(--status-success))',
          'success-soft': 'hsl(var(--status-success-soft))',
          warning: 'hsl(var(--status-warning))',
          danger: 'hsl(var(--status-danger))',
          'danger-soft': 'hsl(var(--status-danger-soft))',
        },
      },
      borderRadius: {
        card: '10px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        sidebar: '14rem',
        'sidebar-collapsed': '5.5rem',
        topbar: '3.5rem',
      },
      boxShadow: {
        card: '0 2px 8px rgb(15 23 42 / 0.05)',
        popover: '0 12px 32px -8px rgb(16 24 40 / 0.18)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
