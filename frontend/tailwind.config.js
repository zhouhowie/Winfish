/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'hsl(var(--base))',
        surface: 'hsl(var(--surface))',
        elevated: 'hsl(var(--elevated))',
        border: 'hsl(var(--border))',
        foreground: 'hsl(var(--fg-primary))',
        secondary: 'hsl(var(--fg-secondary))',
        muted: 'hsl(var(--fg-muted))',
        accent: 'hsl(var(--accent))',
        bull: 'hsl(var(--bull))',
        bear: 'hsl(var(--bear))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        btn: '8px',
      },
    },
  },
  plugins: [],
};
