import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1d9ec9',
        'background-light': '#f0f2f4',
        'background-dark': '#0E1012',
        'surface-dark': '#16191C',
        'surface-darker': '#0A0C0D',
        'border-dark': '#293438',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-noto-sans)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'Courier New', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px -5px rgba(29, 158, 201, 0.3)',
      },
    },
  },
  plugins: [],
}

export default config
