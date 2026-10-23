import toast from 'react-hot-toast';

export const copyToClipboard = async (text: string, label = 'Copiado para a área de transferência') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Falha ao copiar');
  }
};
