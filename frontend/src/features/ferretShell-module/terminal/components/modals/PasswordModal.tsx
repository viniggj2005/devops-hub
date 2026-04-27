import React, { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Modal } from '../../../../shared/components/modals/Modal';
import { ModalButton } from '../../../../shared/components/modals/ModalButton';
import { PasswordModalProps } from '../../../../../interfaces/TerminalInterfaces';

const PasswordModal: React.FC<PasswordModalProps> = ({ open, onClose, onSubmit }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    onSubmit(password);
    setPassword('');
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border backdrop-blur-sm transition-all outline-none
    bg-white/80 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/20`;

  const labelClass = `block text-sm mb-2 text-gray-700 dark:text-gray-200`;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Autenticação SSH"
      description="Credenciais necessárias para conexão."
      size="sm"
      icon={<LockKeyhole className="w-5 h-5 text-amber-500" />}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={() => handleSubmit()}>
            Confirmar
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>
            Senha SSH
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            className={inputClass}
            autoFocus
            required
          />
        </div>
      </form>
    </Modal>
  );
};

export default PasswordModal;
