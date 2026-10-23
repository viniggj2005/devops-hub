import toast from 'react-hot-toast';
import { Database } from 'lucide-react';
import React, { useMemo, useState } from 'react';
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
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('local');
  const { selectedCredentialId } = useDockerClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [labels, setLabels] = useState<KeyValueInput[]>([{ key: '', value: '' }]);
  const [driverOpts, setDriverOpts] = useState<KeyValueInput[]>([{ key: '', value: '' }]);

  const parsedDriverOpts = useMemo(() => {
    return driverOpts
      .filter((entry) => entry.key.trim())
      .reduce<Record<string, string>>((accumulator, { key, value }) => {
        accumulator[key] = value;
        return accumulator;
      }, {});
  }, [driverOpts]);

  const parsedLabels = useMemo(() => {
    return labels
      .filter((entry) => entry.key.trim())
      .reduce<Record<string, string>>((accumulator, { key, value }) => {
        accumulator[key] = value;
        return accumulator;
      }, {});
  }, [labels]);

  const handleChangeEntry = (
    index: number,
    type: 'driver' | 'label',
    field: 'key' | 'value',
    newValue: string
  ) => {
    if (type === 'driver') {
      setDriverOpts((previous) => {
        const next = [...previous];
        next[index] = { ...next[index], [field]: newValue };
        return next;
      });
    } else {
      setLabels((previous) => {
        const next = [...previous];
        next[index] = { ...next[index], [field]: newValue };
        return next;
      });
    }
  };

  const handleAddEntry = (type: 'driver' | 'label') => {
    if (type === 'driver') {
      setDriverOpts((previous) => [...previous, { key: '', value: '' }]);
    } else {
      setLabels((previous) => [...previous, { key: '', value: '' }]);
    }
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selectedCredentialId) return;
    if (!name.trim()) {
      toast.error('Informe o nome do volume.');
      return;
    }

    try {
      setIsSubmitting(true);
      await VolumeService.createVolume(selectedCredentialId, {
        Name: name.trim(),
        Driver: driver,
        Labels: parsedLabels,
        DriverOpts: parsedDriverOpts,
      });

      toast.success('O volume foi criado.');

      onClose();
      onCreated?.();

      setName('');
      setDriver('local');
      setDriverOpts([{ key: '', value: '' }]);
      setLabels([{ key: '', value: '' }]);
    } catch (createError) {
      console.error(createError);
      toast.error('Não foi possível criar o volume.');
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
      title="Novo Volume Docker"
      description="Configuração de volume persistente"
      icon={<Database className="w-5 h-5 text-blue-500" />}
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
            Criar Volume
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
            <option value="local" className="dark:bg-zinc-900">local</option>
            <option value="nfs" className="dark:bg-zinc-900">nfs</option>
            <option value="tmpfs" className="dark:bg-zinc-900">tmpfs</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Opções do driver</label>
            <button
              type="button"
              onClick={() => handleAddEntry('driver')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
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
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
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
