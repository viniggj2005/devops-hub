import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { errorMessage } from '../../functions/ErrorMessage';

type ConfirmOpts = {
  id?: string;
  title: string;
  message: string;
  onCancel?: () => void;
  onConfirm: () => Promise<void> | void;
};

const ConfirmToastCard: React.FC<{
  toastId: string;
  options: ConfirmOpts;
}> = ({ toastId, options }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await options.onConfirm();
      toast.dismiss(toastId);
      toast.success(options.title);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    toast.dismiss(toastId);
    options.onCancel?.();
  };

  return (
    <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
            {options.title}
          </h4>
          <p className="text-xs text-gray-600 dark:text-zinc-400 whitespace-pre-line leading-relaxed">
            {options.message}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-50 transition-colors cursor-pointer"
        >
          Não
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Sim</span>
        </button>
      </div>
    </div>
  );
};

export function useConfirmToast() {
  return (options: ConfirmOpts) => {
    toast.custom(
      (toastInstance) => <ConfirmToastCard toastId={toastInstance.id} options={options} />,
      {
        id: options.id,
        duration: 20000,
        position: 'top-center',
      }
    );
  };
}

