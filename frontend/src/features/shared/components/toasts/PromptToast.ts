import iziToast from 'izitoast';
import { useTheme } from '../../../../hooks/use-theme';
import { toastButton, toastPalette } from './ConfirmToast';

type PromptOpts = {
  id?: string;
  title?: string;
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  inputType?: 'text' | 'password';
};

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function usePromptToast() {
  const { theme } = useTheme();

  return (options: PromptOpts) =>
    new Promise<string | null>((resolve) => {
      let settled = false;
      const palette = toastPalette(theme);
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const inputHtml = `<input type="${options.inputType ?? 'text'}" placeholder="${escapeAttribute(options.placeholder ?? '')}" autocomplete="off" class="!w-64">`;

      iziToast.question({
        close: false,
        icon: 'none',
        overlay: true,
        id: options.id,
        timeout: false,
        drag: false,
        layout: 2,
        position: 'center',
        title: options.title,
        message: options.message,
        titleColor: palette.textColor,
        messageColor: palette.textColor,
        class: `confirm-toast ${palette.themeClass}`,
        backgroundColor: palette.backgroundColor,
        onClosed: () => settle(null),
        inputs: [
          [
            inputHtml,
            'keydown',
            (instance, toast, input, event) => {
              const key = (event as KeyboardEvent).key;
              if (key === 'Enter') {
                settle(input.value);
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'input');
              } else if (key === 'Escape') {
                instance.hide({ transitionOut: 'fadeOut' }, toast, 'input');
              }
            },
            true,
          ],
        ],
        buttons: [
          [
            toastButton(options.confirmLabel ?? 'Confirmar', '!bg-emerald-500 !border-none'),
            (instance, toast, _button, _event, inputs) => {
              settle(inputs[0]?.value ?? '');
              instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
            },
            false,
          ],
          [
            toastButton('Cancelar', '!bg-red-600'),
            (instance, toast) => instance.hide({ transitionOut: 'fadeOut' }, toast, 'button'),
            false,
          ],
        ],
      });
    });
}
