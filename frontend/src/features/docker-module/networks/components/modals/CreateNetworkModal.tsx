import toast from 'react-hot-toast';
import { Network } from 'lucide-react';
import React, { useState } from 'react';
import { NetworkService } from '../../services/NetworkService';
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { ModalProps } from '../../../../../interfaces/TerminalInterfaces';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ModalButton } from '../../../../../features/shared/components/modals/ModalButton';
import * as network from '../../../../../../bindings/github.com/docker/docker/api/types/network/models';

const CreateNetworkModal: React.FC<ModalProps> = ({ open, onClose, onCreated }) => {
  const { selectedCredentialId } = useDockerClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    driver: 'bridge',
    internal: false,
    attachable: false,
  });

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selectedCredentialId || isSubmitting) return;
    if (!formData.name.trim()) {
      toast.error('Informe o nome da rede.');
      return;
    }

    try {
      setIsSubmitting(true);
      const options = new network.CreateOptions({
        Driver: formData.driver,
        Scope: 'local',
        Internal: formData.internal,
        Attachable: formData.attachable,
        Ingress: false,
        ConfigOnly: false,
        Options: {},
        Labels: {},
      });

      await NetworkService.createNetwork(selectedCredentialId, formData.name.trim(), options);

      toast.success('A rede Docker foi criada.');

      onClose();
      onCreated?.();
      setFormData({
        name: '',
        driver: 'bridge',
        internal: false,
        attachable: false,
      });
    } catch (createError) {
      console.error(createError);
      toast.error('Erro ao criar rede Docker.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = `w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all outline-none
    bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    dark:bg-zinc-950/70 dark:border-white/10 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-blue-500/60 dark:focus:ring-blue-500/20`;

  const labelClass = `block text-xs font-medium mb-1.5 text-gray-700 dark:text-zinc-300`;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Nova Rede Docker"
      description="Configuração de topologia de rede"
      icon={<Network className="w-5 h-5 text-blue-500" />}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </ModalButton>
          <ModalButton
            variant="primary"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            Criar Rede
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>
            Nome <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="ex: minha-rede"
            value={formData.name}
            onChange={(event) => setFormData({ ...formData, name: event.target.value })}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Driver
          </label>
          <select
            value={formData.driver}
            onChange={(event) => setFormData({ ...formData, driver: event.target.value })}
            className={inputClass}
          >
            <option value="bridge" className="dark:bg-zinc-900">bridge</option>
            <option value="host" className="dark:bg-zinc-900">host</option>
            <option value="overlay" className="dark:bg-zinc-900">overlay</option>
            <option value="macvlan" className="dark:bg-zinc-900">macvlan</option>
            <option value="none" className="dark:bg-zinc-900">none</option>
          </select>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-zinc-950/40">
            <input
              type="checkbox"
              checked={formData.internal}
              onChange={(event) => setFormData({ ...formData, internal: event.target.checked })}
              className="w-4 h-4 rounded accent-blue-600"
            />
            <div>
              <span className="text-xs font-semibold text-gray-900 dark:text-zinc-200 block">
                Internal
              </span>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                Restringir acesso externo à rede
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-zinc-950/40">
            <input
              type="checkbox"
              checked={formData.attachable}
              onChange={(event) => setFormData({ ...formData, attachable: event.target.checked })}
              className="w-4 h-4 rounded accent-blue-600"
            />
            <div>
              <span className="text-xs font-semibold text-gray-900 dark:text-zinc-200 block">
                Attachable
              </span>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                Permitir que containers standalone se conectem manualmente
              </p>
            </div>
          </label>
        </div>
      </form>
    </Modal>
  );
};

export default CreateNetworkModal;
