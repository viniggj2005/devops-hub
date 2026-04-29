import iziToast from 'izitoast';
import { Database } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { VolumeService } from '../../services/VolumeService';
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { ModalProps } from '../../../../../interfaces/TerminalInterfaces';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { ModalButton } from '../../../../../features/shared/components/modals/ModalButton';

interface KeyValueInput {
  key: string;
  value: string;
}

const CreateVolumeModal: React.FC<ModalProps> = ({ open, onClose, onCreated }) => {
  const { selectedCredentialId } = useDockerClient();
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('local');
  const [driverOpts, setDriverOpts] = useState<KeyValueInput[]>([{ key: '', value: '' }]);
  const [labels, setLabels] = useState<KeyValueInput[]>([{ key: '', value: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedDriverOpts = useMemo(() => {
    return driverOpts
      .filter((entry) => entry.key.trim())
      .reduce<Record<string, string>>((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {});
  }, [driverOpts]);

  const parsedLabels = useMemo(() => {
    return labels
      .filter((entry) => entry.key.trim())
      .reduce<Record<string, string>>((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {});
  }, [labels]);

  const handleChangeEntry = (
    index: number,
    type: 'driver' | 'label',
    field: 'key' | 'value',
    newValue: string
  ) => {
    if (type === 'driver') {
      setDriverOpts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: newValue };
        return next;
      });
    } else {
      setLabels((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: newValue };
        return next;
      });
    }
  };

  const handleAddEntry = (type: 'driver' | 'label') => {
    if (type === 'driver') {
      setDriverOpts((prev) => [...prev, { key: '', value: '' }]);
    } else {
      setLabels((prev) => [...prev, { key: '', value: '' }]);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCredentialId) return;

    try {
      setIsSubmitting(true);
      await VolumeService.createVolume(selectedCredentialId, {
        Name: name,
        Driver: driver,
        DriverOpts: parsedDriverOpts,
        Labels: parsedLabels,
      });

      iziToast.success({
        title: 'Criado com sucesso',
        message: 'O volume foi criado.',
        position: 'bottomRight',
        timeout: 3000,
      });

      onClose();
      onCreated?.();

      setName('');
      setDriver('local');
      setDriverOpts([{ key: '', value: '' }]);
      setLabels([{ key: '', value: '' }]);
    } catch (err) {
      console.error(err);
      iziToast.error({
        title: 'Erro',
        message: 'Não foi possível criar o volume.',
        position: 'bottomRight',
      });
    } finally {
      setIsSubmitting(false);
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
      title="Novo volume Docker"
      description="preencha os dados"
      icon={<Database className="w-5 h-5 text-indigo-500" />}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSubmit} disabled={isSubmitting} isLoading={isSubmitting}>
            Criar Volume
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm mb-4 text-gray-600 dark:text-gray-400">
          Preencha os dados abaixo para criar um novo volume Docker.
        </p>

        <div>
          <label className={labelClass}>
            Nome <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            required
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            placeholder="meu-volume"
          />
        </div>

        <div>
          <label className={labelClass}>Driver</label>
          <select
            value={driver}
            onChange={(event) => setDriver(event.target.value)}
            className={inputClass}
          >
            <option value="local" className="dark:bg-zinc-800">local</option>
            <option value="nfs" className="dark:bg-zinc-800">nfs</option>
            <option value="tmpfs" className="dark:bg-zinc-800">tmpfs</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Opções do driver</label>
            <button
              type="button"
              onClick={() => handleAddEntry('driver')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors"
            >
              + Adicionar opção
            </button>
          </div>
          {driverOpts.map((entry, index) => (
            <div key={`driver-${index}`} className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={entry.key}
                onChange={(event) => handleChangeEntry(index, 'driver', 'key', event.target.value)}
                placeholder="chave"
                className={`${inputClass} !py-2`}
              />
              <input
                type="text"
                value={entry.value}
                onChange={(event) => handleChangeEntry(index, 'driver', 'value', event.target.value)}
                placeholder="valor"
                className={`${inputClass} !py-2`}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Labels</label>
            <button
              type="button"
              onClick={() => handleAddEntry('label')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-500 transition-colors"
            >
              + Adicionar label
            </button>
          </div>
          {labels.map((entry, index) => (
            <div key={`label-${index}`} className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={entry.key}
                onChange={(event) => handleChangeEntry(index, 'label', 'key', event.target.value)}
                placeholder="chave"
                className={`${inputClass} !py-2`}
              />
              <input
                type="text"
                value={entry.value}
                onChange={(event) => handleChangeEntry(index, 'label', 'value', event.target.value)}
                placeholder="valor"
                className={`${inputClass} !py-2`}
              />
            </div>
          ))}
        </div>

      </form>
    </Modal>
  );
};

export default CreateVolumeModal;
