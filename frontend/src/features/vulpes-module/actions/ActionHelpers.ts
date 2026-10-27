import toast from 'react-hot-toast';
import { getToken } from '../../../contexts/AuthContext';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import type { ExportFormat, ExportResult } from '../../../interfaces/VulpesInterfaces';

export const exportFormats: { format: ExportFormat; label: string }[] = [
  { format: 'postman', label: 'Postman (v2.1)' },
  { format: 'insomnia', label: 'Insomnia (v4)' },
];

export const requireToken = () => {
  const token = getToken();
  if (!token) throw new Error('Sessão expirada; faça login novamente');
  return token;
};

export const runWithToast = async <Result>(operation: () => Promise<Result>, successMessage?: string) => {
  try {
    const result = await operation();
    if (successMessage) toast.success(successMessage);
    return result;
  } catch (error) {
    toast.error(errorMessage(error));
    return null;
  }
};

export const announceExport = (result: ExportResult | null, subject: string) => {
  if (!result?.path) return;
  toast.success(`${subject} exportado para ${result.path}`);
  if (result.warnings.length) toast(result.warnings.join('\n'), { icon: '⚠️', duration: 9000 });
};
