import toast from 'react-hot-toast';
import { currentDictionary } from '../../i18n/TranslateError';

export const copyToClipboard = async (text: string, label?: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label ?? currentDictionary().app.common.copied);
  } catch {
    toast.error(currentDictionary().app.common.copyFailed);
  }
};
