import React from 'react';
import { TerminalThemeConfig } from '../../../interfaces/GeneralConfigsInterfaces';

interface TerminalPreviewProps {
  theme: TerminalThemeConfig;
}

const TerminalPreview: React.FC<TerminalPreviewProps> = ({ theme }) => {
  const { colors, fontSize } = theme;

  return (
    <div
      aria-label="Prévia do terminal"
      style={{ backgroundColor: colors.background, color: colors.foreground, fontSize }}
      className="rounded-xl border border-gray-200 dark:border-white/10 p-4 font-mono leading-relaxed overflow-hidden"
    >
      <p>
        <span style={{ color: colors.green }}>ferret@servidor</span>
        <span>:</span>
        <span style={{ color: colors.blue }}>~/projetos</span>
        <span>$ ls -la</span>
      </p>
      <p>
        <span style={{ color: colors.brightBlue }}>docs</span>{'  '}
        <span style={{ color: colors.brightGreen }}>deploy.sh</span>{'  '}
        <span style={{ color: colors.yellow }}>config.yml</span>{'  '}
        <span style={{ color: colors.magenta }}>logo.png</span>{'  '}
        <span style={{ color: colors.cyan }}>link</span>
      </p>
      <p style={{ color: colors.red }}>erro: permissão negada</p>
      <p>
        <span style={{ backgroundColor: colors.selectionBackground }}>texto selecionado</span>
        <span style={{ color: colors.brightBlack }}> # comentário</span>
      </p>
      <p>
        <span style={{ color: colors.green }}>ferret@servidor</span>
        <span>:</span>
        <span style={{ color: colors.blue }}>~</span>
        <span>$ </span>
        <span style={{ backgroundColor: colors.cursor }} className="inline-block w-[0.6em] h-[1.1em] align-middle" />
      </p>
    </div>
  );
};

export default TerminalPreview;
