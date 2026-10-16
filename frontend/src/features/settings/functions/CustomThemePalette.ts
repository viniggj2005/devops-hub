import { AccentFamily, CustomThemeColors } from '../../../interfaces/GeneralConfigsInterfaces';

export type RgbColor = [number, number, number];

const white: RgbColor = [255, 255, 255];
const black: RgbColor = [0, 0, 0];
const neutralFamilies = ['gray', 'zinc', 'slate'];
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

const neutralShadeDarkness: Record<string, number> = {
  50: 0.02, 100: 0.06, 200: 0.13, 300: 0.24, 400: 0.42, 500: 0.56,
  600: 0.68, 700: 0.78, 800: 0.86, 900: 0.92, 950: 0.97,
};

const accentShadeMix: Record<string, { target: RgbColor; amount: number }> = {
  50: { target: white, amount: 0.92 },
  100: { target: white, amount: 0.84 },
  200: { target: white, amount: 0.68 },
  300: { target: white, amount: 0.48 },
  400: { target: white, amount: 0.24 },
  500: { target: white, amount: 0 },
  600: { target: black, amount: 0.14 },
  700: { target: black, amount: 0.3 },
  800: { target: black, amount: 0.44 },
  900: { target: black, amount: 0.56 },
  950: { target: black, amount: 0.7 },
};

const appliedVariables = new Set<string>();

export const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && hexColorPattern.test(value);

export const hexToRgb = (hex: string): RgbColor => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

export const mixColors = (from: RgbColor, to: RgbColor, amount: number): RgbColor =>
  from.map((channel, channelIndex) => Math.round(channel + (to[channelIndex] - channel) * amount)) as RgbColor;

export const toChannels = (color: RgbColor) => color.join(' ');

export const buildCustomThemeVariables = (colors: CustomThemeColors, accentFamilies: AccentFamily[]) => {
  const text = hexToRgb(colors.text);
  const primary = hexToRgb(colors.primary);
  const background = hexToRgb(colors.background);
  const lightEnd = colors.base === 'dark' ? text : background;
  const darkEnd = colors.base === 'dark' ? background : text;
  const variables: Record<string, string> = {};

  for (const [shade, darkness] of Object.entries(neutralShadeDarkness)) {
    const neutralColor = toChannels(mixColors(lightEnd, darkEnd, darkness));
    for (const family of neutralFamilies) {
      variables[`--color-${family}-${shade}`] = neutralColor;
    }
  }

  for (const [shade, { target, amount }] of Object.entries(accentShadeMix)) {
    const accentColor = toChannels(mixColors(primary, target, amount));
    for (const family of accentFamilies) {
      variables[`--color-${family}-${shade}`] = accentColor;
    }
  }

  if (colors.base === 'light') {
    variables['--color-surface'] = toChannels(mixColors(background, white, 0.5));
  }
  return variables;
};

const channelsToHex = (channels: string) =>
  `#${channels
    .split(' ')
    .map(channel => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;

export const customThemeShades = (colors: CustomThemeColors) => {
  const variables = buildCustomThemeVariables(colors, ['cyan']);
  return (family: 'zinc' | 'cyan', shade: number) => channelsToHex(variables[`--color-${family}-${shade}`]);
};

export const applyCustomThemeVariables = (variables: Record<string, string>) => {
  clearCustomThemeVariables();
  const rootStyle = document.documentElement.style;
  for (const [name, value] of Object.entries(variables)) {
    rootStyle.setProperty(name, value);
    appliedVariables.add(name);
  }
};

export const clearCustomThemeVariables = () => {
  const rootStyle = document.documentElement.style;
  appliedVariables.forEach(name => rootStyle.removeProperty(name));
  appliedVariables.clear();
};
