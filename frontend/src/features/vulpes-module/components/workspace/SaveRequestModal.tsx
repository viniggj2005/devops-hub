import toast from 'react-hot-toast';
import { Loader2, Save } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation';
import React, { useEffect, useState } from 'react';
import { listFolders } from '../../functions/CollectionTree';
import { requestActions } from '../../actions/RequestActions';
import { Modal } from '../../../shared/components/modals/Modal';
import { isRequestTab, useVulpesStore } from '../../VulpesStore';
import { collectionActions } from '../../actions/CollectionActions';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { fieldInputClass, fieldLabelClass, primaryButtonClass, secondaryButtonClass } from '../editors/FormStyles';

interface SaveRequestModalProps {
  tabId: string | null;
  onClose: () => void;
}

const SaveRequestModal: React.FC<SaveRequestModalProps> = ({ tabId, onClose }) => {
  const tab = useVulpesStore((state) => {
    const candidate = state.tabs.find((workspaceTab) => workspaceTab.id === tabId);
    return isRequestTab(candidate) ? candidate : undefined;
  });
  const collections = useVulpesStore((state) => state.collections);
  const { dictionary } = useTranslation();
  const saveTexts = dictionary.vulpes.saveRequest;
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [parentId, setParentId] = useState('');
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [newCollectionName, setNewCollectionName] = useState(saveTexts.defaultCollection);

  useEffect(() => {
    if (!tab) return;
    setName(tab.name);
    setParentId('');
    setCollectionId(tab.collectionId ?? collections[0]?.id ?? null);
  }, [tabId]);

  const collection = collections.find((candidate) => candidate.id === collectionId);
  const folders = collection ? listFolders(collection.items) : [];

  const save = async () => {
    if (!tab || !name.trim()) return;
    setSaving(true);
    try {
      const targetCollectionId = collection?.id ?? (await collectionActions.createCollection(newCollectionName.trim() || saveTexts.defaultCollection)).id;
      await requestActions.saveAs(tab.id, targetCollectionId, collection ? parentId : '', name.trim());
      toast.success(dictionary.vulpes.workspace.requestSaved);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      size="sm"
      title={saveTexts.title}
      isOpen={Boolean(tab)}
      onClose={onClose}
      icon={<Save className="w-4 h-4 text-amber-500" />}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            {dictionary.app.common.cancel}
          </button>
          <button type="button" onClick={save} disabled={saving || !name.trim()} className={primaryButtonClass}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {dictionary.vulpes.common.save}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div>
          <label className={fieldLabelClass}>{dictionary.vulpes.common.name}</label>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} className={fieldInputClass} />
        </div>
        {collections.length === 0 ? (
          <div>
            <label className={fieldLabelClass}>{saveTexts.newCollection}</label>
            <input value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} className={fieldInputClass} />
            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-zinc-400">{saveTexts.noCollections}</p>
          </div>
        ) : (
          <>
            <div>
              <label className={fieldLabelClass}>{saveTexts.collection}</label>
              <select
                value={collectionId ?? ''}
                onChange={(event) => {
                  setCollectionId(Number(event.target.value));
                  setParentId('');
                }}
                className={fieldInputClass}
              >
                {collections.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabelClass}>{saveTexts.folder}</label>
              <select value={parentId} onChange={(event) => setParentId(event.target.value)} className={fieldInputClass}>
                <option value="">{saveTexts.rootFolder}</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {`${'  '.repeat(folder.depth)}${folder.name}`}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};

export default SaveRequestModal;
