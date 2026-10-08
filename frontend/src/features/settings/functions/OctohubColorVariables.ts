import { hexToRgb, mixColors, toChannels } from './CustomThemePalette';
import { OctohubColors } from '../../../interfaces/GeneralConfigsInterfaces';

const tonedColorKeys = ['addition', 'deletion'];

export const applyOctohubColorVariables = (octohubColors: OctohubColors) => {
  const rootStyle = document.documentElement.style;
  for (const [key, hex] of Object.entries(octohubColors)) {
    const color = hexToRgb(hex);
    rootStyle.setProperty(`--git-${key}`, toChannels(color));
    if (!tonedColorKeys.includes(key)) continue;
    rootStyle.setProperty(`--git-${key}-soft`, toChannels(mixColors(color, [255, 255, 255], 0.25)));
    rootStyle.setProperty(`--git-${key}-strong`, toChannels(mixColors(color, [0, 0, 0], 0.35)));
  }
};
