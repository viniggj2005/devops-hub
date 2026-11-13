import toast from 'react-hot-toast';
import { formatMessage } from '../../i18n/Languages';
import { currentDictionary } from '../../i18n/TranslateError';
import { getToken } from '../../../contexts/AuthContext';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import type { ExportFormat, ExportResult } from '../../../interfaces/VulpesInterfaces';

export const exportFormats: { format: ExportFormat; label: string }[] = [
  { format: 'postman', label: 'Postman (v2.1)' },
  { format: 'insomnia', label: 'Insomnia (v4)' },
];

export const requireToken = () => {
  const token = getToken();
  if (!token) throw new Error(currentDictionary().vulpes.common.sessionExpired);
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

export const announceExport = (result: ExportResult | null, subject: 'environment' | 'collection') => {
  if (!result?.path) return;
  const commonTexts = currentDictionary().vulpes.common;
  const template = subject === 'environment' ? commonTexts.environmentExported : commonTexts.collectionExported;
  toast.success(formatMessage(template, { path: result.path }));
  if (result.warnings.length) toast(result.warnings.join('\n'), { icon: '⚠️', duration: 9000 });
};
