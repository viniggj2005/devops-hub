import React from 'react';
import { hexToRgb, mixColors, RgbColor } from './CustomThemePalette';
import { ModuleConfig } from '../../../interfaces/GeneralConfigsInterfaces';

const black: RgbColor = [0, 0, 0];
const darkerShadeAmount = 0.3;

const toRgbString = (color: RgbColor) => `rgb(${color.join(' ')})`;

export const moduleIconBackground = (moduleConfig: ModuleConfig): React.CSSProperties | undefined => {
  if (moduleConfig.theme !== 'custom') return undefined;
  const primary = hexToRgb(moduleConfig.customTheme.primary);
  const darker = mixColors(primary, black, darkerShadeAmount);
  return {
    backgroundImage: `linear-gradient(to bottom right, ${toRgbString(primary)}, ${toRgbString(darker)})`,
  };
};
