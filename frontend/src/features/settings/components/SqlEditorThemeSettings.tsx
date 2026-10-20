import ColorField from './ColorField';
import SqlEditorPreview from './SqlEditorPreview';
import React, { useCallback, useMemo } from 'react';
import { Check, RotateCcw, SunMoon } from 'lucide-react';
import { useDebouncedDraft } from '../hooks/useDebouncedDraft';
import { useGeneralConfigsStore } from '../store/GeneralConfigsStore';
import { SqlEditorColorKey, SqlEditorColors } from '../../../interfaces/GeneralConfigsInterfaces';
import {
  sqlEditorColorGroups,
  defaultSqlEditorTheme,
  sqlEditorThemePresets,
  sqlEditorAutoPresetId,
  sqlEditorFontSizeRange,
  resolveSqlEditorColors,
  sqlEditorCustomPresetId,
} from '../constants/SqlEditorThemePresets';

const PresetSample: React.FC<{ colors: SqlEditorColors }> = ({ colors }) => (
  <p style={{ backgroundColor: colors.background, color: colors.foreground }} className="px-3 py-3 font-mono text-xs whitespace-nowrap">
    <span style={{ color: colors.keyword }}>SELECT </span>
    <span style={{ color: colors.identifier }}>nome</span>
    <span style={{ color: colors.keyword }}> FROM </span>
    <span style={{ color: colors.identifier }}>clientes</span>
    <span style={{ color: colors.keyword }}> WHERE </span>
    <span style={{ color: colors.identifier }}>id </span>
    <span style={{ color: colors.operator }}>= </span>
    <span style={{ color: colors.number }}>1</span>
  </p>
);

const SqlEditorThemeSettings: React.FC = () => {
  const savedTheme = useGeneralConfigsStore(state => state.sqlEditorTheme);
  const setSqlEditorTheme = useGeneralConfigsStore(state => state.setSqlEditorTheme);
  const moduleConfig = useGeneralConfigsStore(state => state.modules['talpadb']);
  const saveTheme = useCallback(setSqlEditorTheme, [setSqlEditorTheme]);
  const [draftTheme, setDraftTheme] = useDebouncedDraft(savedTheme, saveTheme);

  const moduleIsDark =
    moduleConfig.theme === 'dark' || (moduleConfig.theme === 'custom' && moduleConfig.customTheme.base === 'dark');
  const customTheme = moduleConfig.theme === 'custom' ? moduleConfig.customTheme : null;
  const effectiveColors = useMemo(
    () => resolveSqlEditorColors(draftTheme, moduleIsDark, customTheme),
    [draftTheme, moduleIsDark, customTheme]
  );
  const isAuto = draftTheme.preset === sqlEditorAutoPresetId;

  const updateColor = (key: SqlEditorColorKey, color: string) =>
    setDraftTheme(current => ({
      ...current,
      preset: sqlEditorCustomPresetId,
      colors: { ...resolveSqlEditorColors(current, moduleIsDark, customTheme), [key]: color },
    }));

  const presetCardClass = (isSelected: boolean) =>
    `relative overflow-hidden rounded-xl border-2 text-left transition-all ${isSelected
      ? 'border-cyan-500 shadow-lg shadow-cyan-500/20'
      : 'border-gray-200 dark:border-white/10 hover:border-cyan-500/50'}`;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Editor SQL do TalpaDB</h2>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">
            Cores da sintaxe e fonte do editor de queries. As mudanças valem na hora, inclusive nas abas já abertas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraftTheme(defaultSqlEditorTheme())}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar padrão
        </button>
      </header>

      <div>
        <h3 className="text-sm font-semibold mb-3">Temas prontos</h3>
        <div role="radiogroup" aria-label="Temas prontos" className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            role="radio"
            aria-checked={isAuto}
            onClick={() => setDraftTheme(current => ({ ...current, preset: sqlEditorAutoPresetId }))}
            className={presetCardClass(isAuto)}
          >
            {customTheme ? (
              <PresetSample colors={resolveSqlEditorColors({ ...draftTheme, preset: sqlEditorAutoPresetId }, moduleIsDark, customTheme)} />
            ) : (
              <div className="grid grid-cols-2">
                <PresetSample colors={resolveSqlEditorColors({ ...draftTheme, preset: sqlEditorAutoPresetId }, true)} />
                <PresetSample colors={resolveSqlEditorColors({ ...draftTheme, preset: sqlEditorAutoPresetId }, false)} />
              </div>
            )}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium">
              <span className="flex items-center gap-1.5">
                <SunMoon className="w-4 h-4 text-cyan-500" />
                Automático
              </span>
              {isAuto && <Check className="w-4 h-4 text-cyan-500" />}
            </div>
          </button>
          {sqlEditorThemePresets.map(preset => {
            const isSelected = draftTheme.preset === preset.id;
            return (
              <button
                type="button"
                role="radio"
                key={preset.id}
                aria-checked={isSelected}
                onClick={() => setDraftTheme(current => ({ ...current, preset: preset.id, colors: { ...preset.colors } }))}
                className={presetCardClass(isSelected)}
              >
                <PresetSample colors={preset.colors} />
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium">
                  {preset.name}
                  {isSelected && <Check className="w-4 h-4 text-cyan-500" />}
                </div>
              </button>
            );
          })}
        </div>
        {isAuto && (
          <p className="mt-2 text-xs text-cyan-600 dark:text-cyan-400">
            Segue o tema do TalpaDB (claro, escuro ou personalizado). Editar uma cor cria um tema personalizado a partir das cores atuais.
          </p>
        )}
        {draftTheme.preset === sqlEditorCustomPresetId && (
          <p className="mt-2 text-xs text-cyan-600 dark:text-cyan-400">Usando cores personalizadas.</p>
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
              min={sqlEditorFontSizeRange.min}
              max={sqlEditorFontSizeRange.max}
              value={draftTheme.fontSize}
              onChange={event => setDraftTheme(current => ({ ...current, fontSize: Number(event.target.value) }))}
              className="mt-2 w-full accent-cyan-500"
            />
          </label>

          {sqlEditorColorGroups.map(group => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold mb-3">{group.title}</h3>
              <div className="grid gap-3 grid-cols-2">
                {group.keys.map(({ key, label }) => (
                  <ColorField key={key} label={label} value={effectiveColors[key]} onChange={color => updateColor(key, color)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="xl:sticky xl:top-4 self-start">
          <h3 className="text-sm font-semibold mb-3">Prévia</h3>
          <SqlEditorPreview colors={effectiveColors} fontSize={draftTheme.fontSize} />
        </div>
      </div>
    </section>
  );
};

export default SqlEditorThemeSettings;
