import ColorField from './ColorField';
import { Check, RotateCcw } from 'lucide-react';
import TerminalPreview from './TerminalPreview';
import React, { useCallback, useState } from 'react';
import { useDebouncedDraft } from '../hooks/useDebouncedDraft';
import { useGeneralConfigsStore } from '../store/GeneralConfigsStore';
import { TerminalColorKey } from '../../../interfaces/GeneralConfigsInterfaces';
import {
  customPresetId,
  terminalColorGroups,
  defaultTerminalTheme,
  terminalThemePresets,
  terminalFontSizeRange,
} from '../constants/TerminalThemePresets';

const previewColorKeys: TerminalColorKey[] = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];

const TerminalThemeSettings: React.FC = () => {
  const savedTheme = useGeneralConfigsStore(state => state.terminalTheme);
  const setTerminalTheme = useGeneralConfigsStore(state => state.setTerminalTheme);
  const saveTheme = useCallback(setTerminalTheme, [setTerminalTheme]);
  const [draftTheme, setDraftTheme] = useDebouncedDraft(savedTheme, saveTheme);
  const [showAllColors, setShowAllColors] = useState(false);

  const visibleGroups = showAllColors ? terminalColorGroups : terminalColorGroups.slice(0, 1);

  const updateColor = (key: TerminalColorKey, color: string) =>
    setDraftTheme(current => ({ ...current, preset: customPresetId, colors: { ...current.colors, [key]: color } }));

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Terminal do FerretShell</h2>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">
            Cores e fonte dos terminais SSH. As mudanças valem na hora, inclusive nos terminais já abertos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraftTheme(defaultTerminalTheme())}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar padrão
        </button>
      </header>

      <div>
        <h3 className="text-sm font-semibold mb-3">Temas prontos</h3>
        <div role="radiogroup" aria-label="Temas prontos" className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {terminalThemePresets.map(preset => {
            const isSelected = draftTheme.preset === preset.id;
            return (
              <button
                type="button"
                role="radio"
                key={preset.id}
                aria-checked={isSelected}
                onClick={() => setDraftTheme(current => ({ ...current, preset: preset.id, colors: { ...preset.colors } }))}
                className={`relative overflow-hidden rounded-xl border-2 text-left transition-all ${isSelected
                  ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                  : 'border-gray-200 dark:border-white/10 hover:border-purple-500/50'}`}
              >
                <div style={{ backgroundColor: preset.colors.background, color: preset.colors.foreground }} className="p-3 font-mono text-xs">
                  <p>$ ssh servidor</p>
                  <div className="mt-2 flex gap-1">
                    {previewColorKeys.map(colorKey => (
                      <span key={colorKey} style={{ backgroundColor: preset.colors[colorKey] }} className="h-2.5 w-2.5 rounded-full" />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium">
                  {preset.name}
                  {isSelected && <Check className="w-4 h-4 text-purple-500" />}
                </div>
              </button>
            );
          })}
        </div>
        {draftTheme.preset === customPresetId && (
          <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">Usando cores personalizadas.</p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <label className="block">
            <span className="flex items-center justify-between text-sm font-semibold">
              Tamanho da fonte
              <span className="font-mono text-gray-500 dark:text-zinc-400">{draftTheme.fontSize}px</span>
            </span>
            <input
              type="range"
              min={terminalFontSizeRange.min}
              max={terminalFontSizeRange.max}
              value={draftTheme.fontSize}
              onChange={event => setDraftTheme(current => ({ ...current, fontSize: Number(event.target.value) }))}
              className="mt-2 w-full accent-purple-500"
            />
          </label>

          {visibleGroups.map(group => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold mb-3">{group.title}</h3>
              <div className="grid gap-3 grid-cols-2">
                {group.keys.map(({ key, label }) => (
                  <ColorField
                    key={key}
                    label={label}
                    value={draftTheme.colors[key]}
                    onChange={color => updateColor(key, color)}
                  />
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShowAllColors(current => !current)}
            className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
          >
            {showAllColors ? 'Mostrar só as cores principais' : 'Editar as 16 cores ANSI'}
          </button>
        </div>

        <div className="xl:sticky xl:top-4 self-start">
          <h3 className="text-sm font-semibold mb-3">Prévia</h3>
          <TerminalPreview theme={draftTheme} />
        </div>
      </div>
    </section>
  );
};

export default TerminalThemeSettings;
