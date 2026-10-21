import { Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { FileUploader } from 'react-drag-drop-files';
import { errorMessage } from '../../../../shared/functions/ErrorMessage';
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { DockerCredentialService } from '../../services/DockerCredentialService';
import { ModalButton } from '../../../../../features/shared/components/modals/ModalButton';
import { CreateDockerCredentialModalProps } from '../../../../../interfaces/DockerCredentialInterfaces';

export const CreateDockerCredentialModal: React.FC<CreateDockerCredentialModalProps> = ({
  open,
  token,
  userId,
  refresh,
  onClose,
}) => {
  const fileTypes = ['PEM', 'TXT'];
  const [ca, setCa] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [key, setKey] = useState<string>('');
  const [cert, setCert] = useState<string>('');
  const [alias, setAlias] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleFileUpload = async (
    file: File | File[],
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const selectedFile = Array.isArray(file) ? file[0] : file;
    const content = await selectedFile.text();
    setter(content);
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (submitting) return;

    if (!alias.trim() || !url.trim() || !ca.trim() || !cert.trim() || !key.trim()) {
      toast.error('Preencha todos os campos obrigatórios e os certificados TLS.');
      return;
    }

    try {
      setSubmitting(true);
      await DockerCredentialService.create(token, {
        ca,
        key,
        cert,
        url: url.trim(),
        alias: alias.trim(),
        userId: Number(userId),
        description: description.trim(),
      });

      toast.success('Credencial criada com sucesso!');

      onClose();
      refresh();
      setCa('');
      setUrl('');
      setKey('');
      setCert('');
      setAlias('');
      setDescription('');
    } catch (createError) {
      toast.error(errorMessage(createError));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = `w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all outline-none
    bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    dark:bg-zinc-950/70 dark:border-white/10 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-blue-500/60 dark:focus:ring-blue-500/20`;

  const labelClass = `block text-xs font-medium mb-1.5 text-gray-700 dark:text-zinc-300`;

  const renderFileField = (
    label: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    placeholder: string
  ) => (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className={labelClass}>{label}</label>
        <div className="w-fit">
          <FileUploader
            types={fileTypes}
            handleChange={(uploadedFile: File | File[]) => handleFileUpload(uploadedFile, setter)}
            name="file"
          >
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer transition-colors">
              Importar arquivo
            </span>
          </FileUploader>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(event) => setter(event.target.value)}
        className={`${inputClass} min-h-[90px] font-mono text-xs`}
        placeholder={placeholder}
        required
      />
    </div>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Nova Credencial Docker"
      description="Configuração de acesso seguro via TLS"
      icon={<Shield className="w-5 h-5 text-blue-500" />}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </ModalButton>
          <ModalButton
            variant="primary"
            onClick={() => handleSubmit()}
            disabled={submitting}
            isLoading={submitting}
          >
            Salvar
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Alias</label>
            <input
              type="text"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              className={inputClass}
              placeholder="ex: Produção AWS"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={inputClass}
              placeholder="ex: Cluster principal"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>URL do Host</label>
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={inputClass}
              placeholder="tcp://192.168.1.100:2376"
              required
            />
          </div>
        </div>

        <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            Certificados TLS
          </h3>

          {renderFileField('ca.pem', ca, setCa, '-----BEGIN CERTIFICATE-----\n...')}
          {renderFileField('cert.pem', cert, setCert, '-----BEGIN CERTIFICATE-----\n...')}
          {renderFileField('key.pem', key, setKey, '-----BEGIN RSA PRIVATE KEY-----\n...')}
        </div>
      </form>
    </Modal>
  );
};
