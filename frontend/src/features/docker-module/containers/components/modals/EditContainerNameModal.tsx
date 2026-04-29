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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName === name) {
      setEditNameModal(false);
      return;
    }

    try {
      setIsLoading(true);
      await handleRename(newName, id);
      setEditNameModal(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border backdrop-blur-sm transition-all outline-none
    bg-white/80 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/20`;

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
          <ModalButton variant="primary" onClick={handleSubmit} isLoading={isLoading}>
            Salvar
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Informe o novo nome para o container.
        </p>
        <div>
          <input
            type="text"
            placeholder="Novo nome"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
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
