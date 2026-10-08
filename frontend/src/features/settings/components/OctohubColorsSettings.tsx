import ColorField from './ColorField';
import { RotateCcw } from 'lucide-react';
import React, { useCallback } from 'react';
import { useDebouncedDraft } from '../hooks/useDebouncedDraft';
import { useGeneralConfigsStore } from '../store/GeneralConfigsStore';
import { OctohubColorKey } from '../../../interfaces/GeneralConfigsInterfaces';
import { octohubColorGroups, defaultOctohubColors } from '../constants/OctohubColorDefaults';

const statusBadges: { key: OctohubColorKey; label: string; fileName: string }[] = [
  { key: 'added', label: 'A', fileName: 'novo-servico.ts' },
  { key: 'modified', label: 'M', fileName: 'main.go' },
  { key: 'deleted', label: 'D', fileName: 'legado.js' },
  { key: 'renamed', label: 'R', fileName: 'README.md' },
  { key: 'untracked', label: 'U', fileName: 'rascunho.txt' },
  { key: 'conflicted', label: '!', fileName: 'go.mod' },
];

const OctohubColorsSettings: React.FC = () => {
  const savedColors = useGeneralConfigsStore(state => state.octohubColors);
  const setOctohubColors = useGeneralConfigsStore(state => state.setOctohubColors);
  const saveColors = useCallback(setOctohubColors, [setOctohubColors]);
  const [draftColors, setDraftColors] = useDebouncedDraft(savedColors, saveColors);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Cores do OctoHub</h2>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">
            Cores do diff e das etiquetas de status dos arquivos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraftColors({ ...defaultOctohubColors })}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar padrão
        </button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          {octohubColorGroups.map(group => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3">{group.description}</p>
              <div className="grid gap-3 grid-cols-2">
                {group.keys.map(({ key, label, hint }) => (
                  <ColorField
                    key={key}
                    hint={hint}
                    label={label}
                    value={draftColors[key]}
                    onChange={color => setDraftColors(current => ({ ...current, [key]: color }))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="xl:sticky xl:top-4 self-start space-y-4">
          <h3 className="text-sm font-semibold">Prévia</h3>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden font-mono text-xs bg-white dark:bg-zinc-900">
            <p className="px-3 py-1 text-gray-500 dark:text-zinc-400">@@ -12,3 +12,3 @@</p>
            <p className="px-3 py-1 text-gray-700 dark:text-zinc-300">  func main() {'{'}</p>
            <p style={{ backgroundColor: `${draftColors.deletion}26`, color: draftColors.deletion }} className="px-3 py-1">
              -   porta := 8080
            </p>
            <p style={{ backgroundColor: `${draftColors.addition}26`, color: draftColors.addition }} className="px-3 py-1">
              +   porta := lerPorta()
            </p>
            <p className="px-3 py-1 text-gray-700 dark:text-zinc-300">  {'}'}</p>
          </div>
          <ul className="rounded-xl border border-gray-200 dark:border-white/10 divide-y divide-gray-200 dark:divide-white/5 bg-white dark:bg-zinc-900">
            {statusBadges.map(badge => (
              <li key={badge.key} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="truncate">{badge.fileName}</span>
                <span
                  style={{
                    color: draftColors[badge.key],
                    borderColor: `${draftColors[badge.key]}33`,
                    backgroundColor: `${draftColors[badge.key]}1a`,
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded border text-[10px] font-bold"
                >
                  {badge.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default OctohubColorsSettings;
