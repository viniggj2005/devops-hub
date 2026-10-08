import colors from 'tailwindcss/colors';

const themeableFamilies = ['gray', 'zinc', 'slate', 'blue', 'purple', 'emerald', 'amber'];

const hexToRgbChannels = (hex) => {
  const value = parseInt(hex.replace('#', ''), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

const gitColorDefaults = {
  added: { DEFAULT: '16 185 129' },
  deleted: { DEFAULT: '239 68 68' },
  renamed: { DEFAULT: '59 130 246' },
  modified: { DEFAULT: '245 158 11' },
  untracked: { DEFAULT: '16 185 129' },
  conflicted: { DEFAULT: '249 115 22' },
  addition: { DEFAULT: '16 185 129', strong: '4 120 87', soft: '52 211 153' },
  deletion: { DEFAULT: '244 63 94', strong: '190 18 60', soft: '251 113 133' },
};

const gitPalette = Object.fromEntries(
  Object.entries(gitColorDefaults).map(([name, tones]) => [
    name,
    Object.fromEntries(
      Object.entries(tones).map(([tone, channels]) => {
        const variableName = tone === 'DEFAULT' ? `--git-${name}` : `--git-${name}-${tone}`;
        return [tone, `rgb(var(${variableName}, ${channels}) / <alpha-value>)`];
      }),
    ),
  ]),
);

const variablePalette = (family) =>
  Object.fromEntries(
    Object.entries(colors[family]).map(([shade, hex]) => [
      shade,
      `rgb(var(--color-${family}-${shade}, ${hexToRgbChannels(hex)}) / <alpha-value>)`,
    ]),
  );

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'text-emerald-400',
    'text-cyan-400',
    'text-amber-300',

    'text-yellow-300',
    'text-rose-400',
    'text-red-500',
    'font-semibold',
    'text-emerald-300',
    'text-sky-400',
  ],
  theme: {
    extend: {
      colors: {
        "terminal-purple": "#5e2750",
        git: gitPalette,
        ...Object.fromEntries(themeableFamilies.map(family => [family, variablePalette(family)])),
      },
      backgroundColor: {
        white: 'rgb(var(--color-surface, 255 255 255) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
