import { Edit } from 'lucide-react';
import React, { useState } from 'react';
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { ModalButton } from '../../../../../features/shared/components/modals/ModalButton';
import { EditContainerNameModalProps } from '../../../../../interfaces/ContainerInterfaces';

const EditContainerNameModal: React.FC<EditContainerNameModalProps> = ({
  id,
  name,
  handleRename,
  setEditNameModal,
}) => {
  const [newName, setNewName] = useState(name);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!newName.trim() || newName.trim() === name) {
      setEditNameModal(false);
      return;
    }

    try {
      setIsLoading(true);
      await handleRename(newName.trim(), id);
      setEditNameModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-2.5 rounded-xl border transition-all outline-none text-sm
    bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    dark:bg-zinc-950/70 dark:border-white/10 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-blue-500/60 dark:focus:ring-blue-500/20`;

  return (
    <Modal
      isOpen={true}
      onClose={() => setEditNameModal(false)}
      title="Renomear Container"
      description={`Original: ${name}`}
      icon={<Edit className="w-5 h-5 text-blue-500" />}
      footer={
        <>
          <ModalButton variant="secondary" onClick={() => setEditNameModal(false)} disabled={isLoading}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={() => handleSubmit()} isLoading={isLoading}>
            Salvar
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-gray-600 dark:text-zinc-400">
          Informe o novo nome de identificação para o container.
        </p>
        <div>
          <input
            type="text"
            placeholder="Novo nome"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            className={inputClass}
            autoFocus
            required
          />
        </div>
      </form>
    </Modal>
  );
};

export default EditContainerNameModal;
