import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import { FileUploader } from 'react-drag-drop-files';
import { toBase64 } from '../functions/TreatmentFunctions';
import { useAuth } from '../../../../contexts/AuthContext';
import { TerminalServices } from '../services/TerminalServices';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { useTranslation } from '../../../i18n/useTranslation';
import { EditSshConnectionFormProps, CreateSshConnectionInterface } from '../../../../interfaces/TerminalInterfaces';

const labelBase = 'text-xs font-medium text-zinc-400';

const inputBase =
  'w-full rounded-lg border border-gray-300 dark:border-white/10 ' +
  'bg-white dark:bg-zinc-800 px-3 py-2 outline-none ' +
  'focus:ring-2 focus:ring-emerald-500 dark:text-white';

const EditSshConnectionForm: React.FC<EditSshConnectionFormProps> = ({
  id,
  onSuccess,
  connection,
}) => {
  const { user, token } = useAuth();
  const fileTypes = ['PEM', 'TXT'];
  const { dictionary, formatMessage } = useTranslation();
  const formTexts = dictionary.ferretShell.connectionForm;
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [formData, setFormData] = useState<CreateSshConnectionInterface>(connection);

  useEffect(() => {
    setFormData(connection);
  }, [connection]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === 'port') {
      setFormData((previous: any) => ({ ...previous, [name]: Number(value) || 0 }));
    } else {
      setFormData((previous: any) => ({ ...previous, [name]: value }));
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

    setFormData((previous: any) => ({ ...previous, key: base64 }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.key && !formData.password) {
      toast.error(formTexts.credentialsRequired);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        userId: user?.id,
        key: toBase64(formData.key),
        password: formData.password ? btoa(formData.password) : undefined,
      };
      await TerminalServices.updateSshConnection(token ?? '', id, payload);
      toast.success(formTexts.updated);
      onSuccess?.();
    } catch (error: any) {
      toast.error(formatMessage(formTexts.updateFailed, { error: errorMessage(error) }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2 grid gap-1.5">
          <label className={labelBase}>{formTexts.alias}</label>
          <input
            className={inputBase}
            type="text"
            name="alias"
            value={formData.alias}
            onChange={handleChange}
          />
        </div>
        <div className="grid gap-1.5">
          <label className={labelBase}>{formTexts.host}</label>
          <input
            className={inputBase}
            type="text"
            name="host"
            value={formData.host}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid gap-1.5">
          <label className={labelBase}>{formTexts.systemUser}</label>
          <input
            className={inputBase}
            type="text"
            name="systemUser"
            value={formData.systemUser}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid gap-1.5">
          <label className={labelBase}>{formTexts.port}</label>
          <input
            className={inputBase}
            type="number"
            min={1}
            max={65535}
            name="port"
            value={formData.port}
            onChange={handleChange}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={labelBase}>{formTexts.password}</label>
          <input
            className={inputBase}
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={formTexts.keepPasswordPlaceholder}
          />
        </div>

        <div className="md:col-span-2 grid gap-2">
          <label className={labelBase}>{formTexts.keyFile}</label>
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-white/10 p-4">
            <FileUploader handleChange={handleFileChange} name="key" types={fileTypes}>
              <div className="flex cursor-pointer items-center justify-between">
                <span className="text-sm">
                  {fileName
                    ? formatMessage(formTexts.selectedFile, { name: fileName })
                    : formTexts.dropReplaceKey}
                </span>
                <span className="rounded-md border px-2 py-1 text-xs">{formTexts.browse}</span>
              </div>
            </FileUploader>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onSuccess}
          className="rounded-lg border border-gray-300 dark:border-white/10 px-4 py-2 text-sm hover:scale-[0.98]"
        >
          {dictionary.app.common.cancel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? formTexts.saving : formTexts.saveChanges}
        </button>
      </div>
    </form>
  );
};

export default EditSshConnectionForm;
