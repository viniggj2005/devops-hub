import iziToast from 'izitoast';
import { Network } from 'lucide-react';
import React, { useState } from 'react';
import { network } from '../../../../../../wailsjs/go/models';
import { NetworkService } from '../../services/NetworkService';
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { ModalProps } from '../../../../../interfaces/TerminalInterfaces';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ModalButton } from '../../../../../features/shared/components/modals/ModalButton';

const CreateNetworkModal: React.FC<ModalProps> = ({ open, onClose, onCreated }) => {
  const { selectedCredentialId } = useDockerClient();
  const [formData, setFormData] = useState({
    name: '',
    driver: 'bridge',
    internal: false,
    attachable: false
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCredentialId) return;

    try {
      const options = new network.CreateOptions({
        Driver: formData.driver,
        Scope: "local",
        Internal: formData.internal,
        Attachable: formData.attachable,
        Ingress: false,
        ConfigOnly: false,
        Options: {},
        Labels: {},
      });

      await NetworkService.createNetwork(selectedCredentialId, formData.name, options);

      iziToast.success({
        title: 'Criado com sucesso',
        message: 'A network foi criada.',
        position: 'bottomRight',
        timeout: 3000,
      });

      onClose();
      onCreated?.();
      setFormData({
        name: '',
        driver: 'bridge',
        internal: false,
        attachable: false
      });
    } catch (err) {
      console.error(err);
      iziToast.error({
        title: 'Erro',
        message: 'Erro ao criar network',
        position: 'bottomRight'
      });
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border backdrop-blur-sm transition-all outline-none
    bg-white/80 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/20`;

  const labelClass = `block text-sm mb-2 text-gray-700 dark:text-gray-200`;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Nova Network Docker"
      description="preencha os dados"
      icon={<Network className="w-5 h-5 text-blue-500" />}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSubmit}>
            Criar Network
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm mb-4 text-gray-600 dark:text-gray-400">
          Preencha os dados para criar uma nova rede Docker.
        </p>

        <div>
          <label className={labelClass}>
            Nome <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="ex: minha-rede"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
            className={inputClass}
          >
            <option value="bridge" className="dark:bg-zinc-800">bridge</option>
            <option value="host" className="dark:bg-zinc-800">host</option>
            <option value="overlay" className="dark:bg-zinc-800">overlay</option>
            <option value="macvlan" className="dark:bg-zinc-800">macvlan</option>
            <option value="none" className="dark:bg-zinc-800">none</option>
          </select>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.internal}
              onChange={(e) => setFormData({ ...formData, internal: e.target.checked })}
              className="w-5 h-5 rounded border-2 bg-white/10 border-gray-300 dark:border-white/20 checked:bg-blue-500 checked:border-blue-500 transition-all dark:bg-white/10"
            />
            <div>
              <span className="text-gray-900 dark:text-gray-200">Internal</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Restringir acesso externo à rede
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.attachable}
              onChange={(e) => setFormData({ ...formData, attachable: e.target.checked })}
              className="w-5 h-5 rounded border-2 bg-white/10 border-gray-300 dark:border-white/20 checked:bg-blue-500 checked:border-blue-500 transition-all dark:bg-white/10"
            />
            <div>
              <span className="text-gray-900 dark:text-gray-200">Attachable</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Permitir containers standalone se conectarem
              </p>
            </div>
          </label>
        </div>
      </form>
    </Modal>
  );
};

export default CreateNetworkModal;
