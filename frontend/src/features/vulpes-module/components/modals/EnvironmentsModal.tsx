import toast from 'react-hot-toast';
import { quickImportFiles } from './ImportModal';
import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVulpesStore } from '../../VulpesStore';
import VariablesTable from '../editors/VariablesTable';
import { Modal } from '../../../shared/components/modals/Modal';
import { collectionActions } from '../../actions/CollectionActions';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import ContextMenu from '../../../shared/components/menus/ContextMenu';
import { VariableScopeProvider } from '../../contexts/VariableScopeContext';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';
import type { Environment, ExportFormat } from '../../../../interfaces/VulpesInterfaces';
import { announceExport, exportFormats, runWithToast } from '../../actions/ActionHelpers';
import { CheckCircle2, Download, Globe2, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { fieldInputClass, fieldLabelClass, iconButtonClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';

interface EnvironmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EnvironmentsModal: React.FC<EnvironmentsModalProps> = ({ isOpen, onClose }) => {
  const confirm = useConfirmToast();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Environment | null>(null);
  const [exportMenu, setExportMenu] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { environments, activeEnvironmentId, setActiveEnvironment } = useVulpesStore(
    useShallow((state) => ({
      environments: state.environments,
      activeEnvironmentId: state.activeEnvironmentId,
      setActiveEnvironment: state.setActiveEnvironment,
    }))
  );
  const selected = environments.find((environment) => environment.id === selectedId) ?? null;
  const dirty = Boolean(draft && selected && JSON.stringify(draft) !== JSON.stringify(selected));

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId((current) => current ?? activeEnvironmentId ?? environments[0]?.id ?? null);
  }, [isOpen]);

  useEffect(() => setDraft(selected ? structuredClone(selected) : null), [selected]);

  const createEnvironment = async () => {
    const environment = await runWithToast(() => collectionActions.createEnvironment('Novo ambiente'));
    if (environment) setSelectedId(environment.id);
  };

  const importEnvironments = async () => {
    const result = await quickImportFiles();
    if (!result) return;
    if (result.environments.length) {
      setSelectedId(result.environments[0].id);
      toast.success(`${result.environments.length} ambiente(s) importado(s)`);
    }
    if (result.collections.length) toast.success(`${result.collections.length} coleção(ões) importada(s)`);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await collectionActions.updateEnvironment(draft);
      toast.success('Ambiente salvo');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const exportEnvironment = async (environment: Environment, format: ExportFormat) =>
    announceExport(await runWithToast(() => collectionActions.exportEnvironment(environment, format)), 'Ambiente');

  const removeEnvironment = (environment: Environment) =>
    confirm({
      title: 'Excluir ambiente?',
      message: `O ambiente "${environment.name}" e suas variáveis serão removidos.`,
      onConfirm: async () => {
        await collectionActions.deleteEnvironment(environment);
        setSelectedId(null);
      },
    });

  return (
    <Modal
      size="xl"
      isOpen={isOpen}
      onClose={onClose}
      title="Ambientes"
      description="Variáveis usadas como {{nome}} nas requisições"
      icon={<Globe2 className="w-4 h-4 text-amber-500" />}
    >
      <VariableScopeProvider environmentVariablesOverride={draft?.variables}>
        <div className="flex gap-5 min-h-[420px] -m-2">
          <aside className="w-56 flex-shrink-0 flex flex-col gap-2">
            <div className="flex gap-2">
              <button type="button" onClick={createEnvironment} className={`flex-1 ${secondaryButtonClass}`}>
                <Plus className="w-3.5 h-3.5" />
                Novo
              </button>
              <button type="button" onClick={importEnvironments} title="Importar do Postman ou do Insomnia" className={secondaryButtonClass}>
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded-xl border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
              {environments.length === 0 && <p className="p-3 text-xs text-gray-500 dark:text-zinc-400">Nenhum ambiente criado.</p>}
              {environments.map((environment) => (
                <button
                  type="button"
                  key={environment.id}
                  onClick={() => setSelectedId(environment.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    environment.id === selectedId ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="flex-1 min-w-0 truncate font-semibold">{environment.name}</span>
                  {environment.id === activeEnvironmentId && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </aside>

          <section className="flex-1 min-w-0 flex flex-col gap-4">
            {!draft ? (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-500 dark:text-zinc-400">
                Selecione ou crie um ambiente para editar suas variáveis.
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className={fieldLabelClass}>Nome</label>
                    <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={fieldInputClass} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveEnvironment(draft.id === activeEnvironmentId ? null : draft.id)}
                    className={secondaryButtonClass}
                  >
                    {draft.id === activeEnvironmentId ? 'Desativar' : 'Usar este ambiente'}
                  </button>
                  <button
                    type="button"
                    title="Exportar para Postman ou Insomnia"
                    onClick={(event) => {
                      const bounds = event.currentTarget.getBoundingClientRect();
                      setExportMenu({ x: bounds.left, y: bounds.bottom + 4 });
                    }}
                    className={iconButtonClass}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {exportMenu && (
                    <ContextMenu
                      x={exportMenu.x}
                      y={exportMenu.y}
                      title={draft.name}
                      onClose={() => setExportMenu(null)}
                      entries={exportFormats.map(({ format, label }) => ({
                        icon: Download,
                        label: `Exportar para ${label}`,
                        onClick: () => exportEnvironment(draft, format),
                      }))}
                    />
                  )}
                  <button
                    type="button"
                    title="Excluir ambiente"
                    onClick={() => selected && removeEnvironment(selected)}
                    className={`${iconButtonClass} hover:text-rose-500`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <VariablesTable variables={draft.variables} onChange={(variables) => setDraft({ ...draft, variables })} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500">Valores secretos ficam ocultos na tela; tudo é salvo criptografado.</p>
                  <button type="button" onClick={save} disabled={saving || !dirty} className={primaryButtonClass}>
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Salvar alterações
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </VariableScopeProvider>
    </Modal>
  );
};

export default EnvironmentsModal;
