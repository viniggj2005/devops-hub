import iziToast from 'izitoast';
import { useTheme } from '../../../../hooks/use-theme';

type ConfirmOpts = {
  id?: string;
  title: string;
  message: string;
  onCancel?: () => void;
  onConfirm: () => Promise<void> | void;
};

export function toastPalette(theme: string) {
  const isDark = theme === 'dark';
  return {
    textColor: isDark ? '#ffffff' : '#18181b',
    themeClass: isDark ? 'confirm-toast--dark' : 'confirm-toast--light',
    backgroundColor: isDark ? '#27272a' : '#ffffff',
  };
}

export const toastButton = (label: string, colorClass: string) =>
  `<button type="button" class="px-3 py-1 ${colorClass} hover:scale-95"><span class="text-white font-bold">${label}</span></button>`;

export function useConfirmToast() {
  const { theme } = useTheme();

  return (options: ConfirmOpts) => {
    const palette = toastPalette(theme);
    iziToast.question({
      close: false,
      icon: 'none',
      overlay: true,
      id: options.id,
      timeout: 20000,
      position: 'center',
      message: options.message,
      titleColor: palette.textColor,
      messageColor: palette.textColor,
      class: `confirm-toast ${palette.themeClass}`,
      backgroundColor: palette.backgroundColor,
      buttons: [
        [
          toastButton('Sim', '!bg-emerald-500 !border-none'),
          async (instance, toast) => {
            try {
              await options.onConfirm();
              iziToast.success({
                title: 'Sucesso!',
                message: options.title,
                position: 'bottomRight',
              });
            } catch (error) {
              iziToast.error({ title: 'Erro', message: String(error), position: 'bottomRight' });
            } finally {
              instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
            }
          },
          false,
        ],
        [
          toastButton('Não', '!bg-red-600'),
          (instance, toast) => {
            instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
            options.onCancel?.();
          },
          false,
        ],
      ],
    });
  };
}
