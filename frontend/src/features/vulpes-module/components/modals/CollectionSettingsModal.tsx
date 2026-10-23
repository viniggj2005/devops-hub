import toast from 'react-hot-toast';
import AuthEditor from '../editors/AuthEditor';
import SectionTabs from '../editors/SectionTabs';
import { Loader2, Settings2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import ScriptsPanel from '../request/ScriptsPanel';
import VariablesTable from '../editors/VariablesTable';
import { emptyAuth } from '../../functions/RequestDefaults';
import type { TreeTarget } from '../sidebar/SidebarTreeContext';
import { Modal } from '../../../shared/components/modals/Modal';
import { collectionActions } from '../../actions/CollectionActions';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { describeInheritedAuth } from '../../functions/CollectionTree';
import type { Auth, Variable } from '../../../../interfaces/VulpesInterfaces';
import { fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';

type SettingsSection = 'variables' | 'auth' | 'description' | 'scripts';

interface CollectionSettingsModalProps {
  onClose: () => void;
  target: TreeTarget | null;
}

const CollectionSettingsModal: React.FC<CollectionSettingsModalProps> = ({ target, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [variables, setVariables] = useState<Variable[]>([]);
  const [auth, setAuth] = useState<Auth>(emptyAuth('none'));
  const [section, setSection] = useState<SettingsSection>('variables');
  const folder = target?.item ?? null;
  const scripts = folder ? folder.scripts : target?.collection.scripts ?? [];

  useEffect(() => {
    if (!target) return;
    const source = target.item;
    setSection(source ? 'auth' : 'variables');
    setVariables(target.collection.variables);
    setDescription(source ? source.description : target.collection.description);
    setAuth(source ? source.auth ?? emptyAuth('inherit') : target.collection.auth);
  }, [target]);

  const save = async () => {
    if (!target) return;
    setSaving(true);
    try {
      if (target.item) await collectionActions.saveItem(target.collection.id, { ...target.item, auth, description });
      else await collectionActions.updateCollection(target.collection, { auth, variables, description });
      toast.success('Configurações salvas');
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      size="lg"
      onClose={onClose}
      isOpen={Boolean(target)}
      description={folder?.name ?? target?.collection.name}
      title={folder ? 'Configurações da pasta' : 'Configurações da coleção'}
      icon={<Settings2 className="w-4 h-4 text-amber-500" />}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButtonClass}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </button>
        </>
      }
    >
      <div className="-mx-6 -mt-6 mb-4">
        <SectionTabs
          active={section}
          onChange={setSection}
          tabs={[
            { key: 'variables', label: 'Variáveis', hidden: Boolean(folder), count: variables.length },
            { key: 'auth', label: 'Autorização' },
            { key: 'description', label: 'Descrição' },
            { key: 'scripts', label: 'Scripts', hidden: scripts.length === 0 },
          ]}
        />
      </div>
      {section === 'variables' && !folder && (
        <div className="space-y-2">
          <VariablesTable variables={variables} onChange={setVariables} />
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">
            Use como {'{{nome}}'} em qualquer requisição da coleção. Variáveis do ambiente ativo têm prioridade sobre as da coleção.
          </p>
        </div>
      )}
      {section === 'auth' && target && (
        <AuthEditor
          auth={auth}
          onChange={setAuth}
          allowInherit={Boolean(folder)}
          inheritedHint={folder ? describeInheritedAuth(target.collection, folder.id) : undefined}
        />
      )}
      {section === 'description' && (
        <div>
          <label className={fieldLabelClass}>Descrição (Markdown)</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full h-56 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-950 p-3 text-xs text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}
      {section === 'scripts' && <ScriptsPanel scripts={scripts} />}
    </Modal>
  );
};

export default CollectionSettingsModal;
