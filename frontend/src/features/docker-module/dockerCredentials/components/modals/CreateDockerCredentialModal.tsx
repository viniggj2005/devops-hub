import iziToast from "izitoast";
import { Shield } from "lucide-react";
import React, { useState } from "react";
import { FileUploader } from "react-drag-drop-files";
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { ModalButton } from '../../../../../features/shared/components/modals/ModalButton';
import { DockerCredentialService } from "../../services/DockerCredentialService";
import { CreateDockerCredentialModalProps } from '../../../../../interfaces/DockerCredentialInterfaces';

export const CreateDockerCredentialModal: React.FC<CreateDockerCredentialModalProps> = ({
  open,
  token,
  userId,
  refresh,
  onClose,
}) => {
  const fileTypes = ["PEM", "TXT"];
  const [ca, setCa] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [key, setKey] = useState<string>("");
  const [cert, setCert] = useState<string>("");
  const [alias, setAlias] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleFileUpload = async (file: File | File[], setter: React.Dispatch<React.SetStateAction<string>>) => {
    const selectedFile = Array.isArray(file) ? file[0] : file;
    const content = await selectedFile.text();
    setter(content);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      await DockerCredentialService.create(token, {
        ca,
        key,
        url,
        cert,
        alias,
        description,
        userId: Number(userId),
      });

      iziToast.success({
        title: "Sucesso",
        message: "Credencial criada!",
        position: "bottomRight",
      });

      onClose();
      refresh();
      setCa("");
      setUrl("");
      setKey("");
      setCert("");
      setAlias("");
      setDescription("");
    } catch (err) {
      iziToast.error({
        title: "Erro",
        message: String(err),
        position: "bottomRight",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border backdrop-blur-sm transition-all outline-none
    bg-white/80 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
    dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/20`;

  const labelClass = `block text-sm mb-2 text-gray-700 dark:text-gray-200`;

  const renderFileField = (
    label: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    placeholder: string
  ) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className={labelClass}>{label}</label>
        <div className="w-fit">
          <FileUploader
            types={fileTypes}
            handleChange={(f: File | File[]) => handleFileUpload(f, setter)}
            name="file"
          >
            <span className="text-xs font-semibold text-blue-600 hover:text-blue-500 cursor-pointer transition-colors">
              Importar arquivo
            </span>
          </FileUploader>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setter(e.target.value)}
        className={`${inputClass} min-h-[100px] font-mono text-xs`}
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
      description="configuração de acesso seguro"
      icon={<Shield className="w-5 h-5 text-blue-600" />}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSubmit} disabled={submitting} isLoading={submitting}>
            Salvar
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm mb-4 text-gray-600 dark:text-gray-400">
          Preencha as informações de conexão segura (TLS) para o novo ambiente Docker.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Alias</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
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
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="ex: Servidor principal"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>URL do Host</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={inputClass}
              placeholder="tcp://192.168.1.100:2376"
              required
            />
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-white/10">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Certificados TLS</h3>

          {renderFileField("ca.pem", ca, setCa, "-----BEGIN CERTIFICATE-----\n...")}
          {renderFileField("cert.pem", cert, setCert, "-----BEGIN CERTIFICATE-----\n...")}
          {renderFileField("key.pem", key, setKey, "-----BEGIN RSA PRIVATE KEY-----\n...")}
        </div>
      </form>
    </Modal>
  );
};
