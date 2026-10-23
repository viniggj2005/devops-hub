import toast from 'react-hot-toast';
import { getToken } from '../../../contexts/AuthContext';
import { errorMessage } from '../../shared/functions/ErrorMessage';

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
