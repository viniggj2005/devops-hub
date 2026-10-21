import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import React, { useState } from 'react';

type PromptOpts = {
  id?: string;
  title?: string;
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  inputType?: 'text' | 'password';
};

const PromptToastCard: React.FC<{
  toastId: string;
  options: PromptOpts;
  onSettle: (value: string | null) => void;
}> = ({ toastId, options, onSettle }) => {
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = (event?: React.FormEvent) => {
    event?.preventDefault();
    onSettle(inputValue);
    toast.dismiss(toastId);
  };

  const handleCancel = () => {
    onSettle(null);
    toast.dismiss(toastId);
  };

  return (
    <form
      onSubmit={handleConfirm}
      className="pointer-events-auto w-full max-w-sm rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-2xl space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {options.title && (
            <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              {options.title}
            </h4>
          )}
          <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
            {options.message}
          </p>
        </div>
      </div>

      <input
        autoFocus
        value={inputValue}
        type={options.inputType ?? 'text'}
        placeholder={options.placeholder ?? ''}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            handleCancel();
          }
        }}
        className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-950 text-xs text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
        >
          {options.confirmLabel ?? 'Confirmar'}
        </button>
      </div>
    </form>
  );
};

export function usePromptToast() {
  return (options: PromptOpts) =>
    new Promise<string | null>((resolve) => {
      let settled = false;
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      toast.custom(
        (toastInstance) => (
          <PromptToastCard
            toastId={toastInstance.id}
            options={options}
            onSettle={settle}
          />
        ),
        {
          id: options.id,
          duration: Infinity,
          position: 'top-center',
        }
      );
    });
}

