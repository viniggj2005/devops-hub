import React from 'react';
import { fieldInputClass, fieldLabelClass } from './FormStyles';
import ToggleSwitch from '../../../shared/components/forms/ToggleSwitch';

interface SettingRowProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export const SettingRow: React.FC<SettingRowProps> = ({ title, description, children }) => (
  <div className="flex items-center justify-between gap-6 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{title}</p>
      <p className="text-xs text-gray-500 dark:text-zinc-400">{description}</p>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

interface TlsSettingProps {
  skipTlsVerify: boolean;
  onChange: (skipTlsVerify: boolean) => void;
}

export const TlsSetting: React.FC<TlsSettingProps> = ({ skipTlsVerify, onChange }) => (
  <SettingRow
    title="Verificar certificado TLS"
    description="Desative apenas para servidores com certificado autoassinado ou inválido."
  >
    <ToggleSwitch label="Verificar certificado TLS" checked={!skipTlsVerify} onChange={(checked) => onChange(!checked)} />
  </SettingRow>
);

interface TimeoutSettingProps {
  timeoutMs: number;
  onChange: (timeoutMs: number) => void;
}

export const TimeoutSetting: React.FC<TimeoutSettingProps> = ({ timeoutMs, onChange }) => (
  <SettingRow title="Tempo limite" description="Em milissegundos. Use 0 para aguardar indefinidamente.">
    <input
      min={0}
      step={500}
      type="number"
      value={timeoutMs}
      aria-label="Tempo limite em milissegundos"
      onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      className={`${fieldInputClass} w-32 text-right font-mono`}
    />
  </SettingRow>
);

export const SettingsSection: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="max-w-2xl">
    {title && <h4 className={fieldLabelClass}>{title}</h4>}
    <div className="rounded-xl border border-gray-200 dark:border-white/10 px-4">{children}</div>
  </div>
);
