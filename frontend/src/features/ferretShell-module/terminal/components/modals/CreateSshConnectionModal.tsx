import iziToast from 'izitoast';
import React, { useState } from 'react';
import { TerminalSquare } from 'lucide-react';
import { FileUploader } from 'react-drag-drop-files';
import { useAuth } from '../../../../../contexts/AuthContext';
import { Modal } from '../../../../shared/components/modals/Modal';
import { TerminalServices } from '../../services/TerminalServices';
import { ModalButton } from '../../../../shared/components/modals/ModalButton';
import { CreateSshConnectionInterface, ModalProps } from '../../../../../interfaces/TerminalInterfaces';

const CreateSshConnectionModal: React.FC<ModalProps> = ({ open, onClose, onCreated }) => {
  const fileTypes = ['PEM', 'TXT'];
  const { token, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [formData, setFormData] = useState<CreateSshConnectionInterface>({
    key: '',
    port: 22,
    host: '',
    alias: '',
    systemUser: '',
    password: '',
    knownHosts: '',
    userId: user ? user.id : 1,
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === 'port') {
      setFormData((previous) => ({ ...previous, [name]: Number(value) || 0 }));
    } else {
      setFormData((previous) => ({ ...previous, [name]: value }));
    }
  };

  const handleFileChange = async (file: File | File[]) => {
    const selectedFile = Array.isArray(file) ? file[0] : file;
    setFileName(selectedFile.name);

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(selectedFile);
    });

    setFormData((previous) => ({ ...previous, key: base64 }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.key && !formData.password) {
      iziToast.error({
        title: 'Erro',
        message: 'Você deve fornecer uma senha ou um arquivo de chave.',
        position: 'bottomRight',
      });
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (payload.password) {
        payload.password = btoa(payload.password);
      }
      await TerminalServices.createSshConnection(token ? token : '', payload);
      iziToast.success({
        title: 'Criado com sucesso',
        message: 'A conexão SSH foi criada.',
        position: 'bottomRight',
        timeout: 3000,
      });
      onClose();
      onCreated?.();
      setFormData({
        key: '',
        port: 22,
        host: '',
        alias: '',
        systemUser: '',
        password: '',
        knownHosts: '',
        userId: user ? user.id : 1,
      });
      setFileName('');
    } catch (error) {
      iziToast.error({
        title: 'Erro',
        message: `Erro ao criar conexão: ${String(error)}`,
        position: 'bottomRight',
      });
    } finally {
      setSubmitting(false);
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
      title="Nova conexão SSH"
      description="preencha os dados"
      icon={<TerminalSquare className="w-5 h-5 text-emerald-500" />}
      footer={
        <>
          <ModalButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSubmit} disabled={submitting} isLoading={submitting}>
            Criar Conexão
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm mb-4 text-gray-600 dark:text-gray-400">
          Preencha os dados abaixo para criar uma nova conexão SSH.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>
              Alias <span className="opacity-60 text-xs">(opcional)</span>
            </label>
            <input
              className={inputClass}
              type="text"
              name="alias"
              value={formData.alias}
              onChange={handleChange}
              placeholder="alias"
            />
          </div>

          <div>
            <label className={labelClass}>Host</label>
            <input
              className={inputClass}
              type="text"
              name="host"
              value={formData.host}
              onChange={handleChange}
              required
              placeholder="ex: 192.168.0.10"
            />
          </div>

          <div>
            <label className={labelClass}>Usuário</label>
            <input
              className={inputClass}
              type="text"
              name="systemUser"
              value={formData.systemUser}
              onChange={handleChange}
              required
              placeholder="ex: ubuntu"
            />
          </div>

          <div>
            <label className={labelClass}>Porta</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              max={65535}
              name="port"
              value={formData.port}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className={labelClass}>Senha <span className="opacity-60 text-xs">(opcional se usar chave)</span></label>
            <input
              className={inputClass}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="sua senha"
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Arquivo da chave (.pem, .txt)</label>
            <div className={`rounded-xl border border-dashed p-4 transition-all
              ${fileName
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-gray-300 dark:border-white/20 bg-white/50 dark:bg-white/5'
              }`}>
              <FileUploader handleChange={handleFileChange} name="key" types={fileTypes}>
                <div className="flex cursor-pointer items-center justify-between">
                  <span className={`text-sm ${fileName ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {fileName ? `Selecionado: ${fileName}` : 'Arraste e solte ou clique para enviar'}
                  </span>
                  <span className="rounded-lg border border-gray-300 dark:border-white/20 px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 shadow-sm">
                    Procurar
                  </span>
                </div>
              </FileUploader>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreateSshConnectionModal;
