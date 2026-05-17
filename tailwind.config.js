/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // FilmMarket Design System - Vintage Film Palette
        ink: {
          DEFAULT: '#1A1A1A',
          light: '#2D2D2D',
          muted: '#6B5B45',
        },
        amber: {
          film: '#D4840A',
          light: '#E8A030',
          pale: '#F5D499',
        },
        leather: {
          DEFAULT: '#8B4513',
          light: '#A0522D',
        },
        paper: {
          DEFAULT: '#F5F0E8',
          warm: '#EDE5D5',
          dark: '#D6CBBF',
        },
        film: {
          red: '#C0392B',
          green: '#27AE60',
          blue: '#2980B9',
        }
      },
      fontFamily: {
        display: ['Abril Fatface', 'serif'],
        body: ['Merriweather', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'retro': '4px 4px 0px #1A1A1A',
        'retro-sm': '2px 2px 0px #1A1A1A',
        'retro-amber': '4px 4px 0px #D4840A',
        'vintage': '0 2px 20px rgba(26,26,26,0.15)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(212, 132, 10, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(212, 132, 10, 0.8)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
