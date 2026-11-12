import React from 'react';
import RichMessage from '../../../i18n/RichMessage';
import { useTranslation } from '../../../i18n/useTranslation';

const keyClass = 'px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 font-mono text-[10px]';

const VariableShortcutHint: React.FC<{ template: string }> = ({ template }) => {
  const { dictionary } = useTranslation();

  return (
    <RichMessage
      template={template}
      values={{
        braces: <code className="font-mono">{'{{'}</code>,
        slash: <kbd className={keyClass}>Ctrl+/</kbd>,
        space: <kbd className={keyClass}>{dictionary.vulpes.common.ctrlSpace}</kbd>,
      }}
    />
  );
};

export default VariableShortcutHint;
