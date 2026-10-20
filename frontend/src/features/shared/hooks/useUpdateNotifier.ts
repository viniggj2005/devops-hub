import { useEffect, useRef } from 'react';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import { useConfirmToast } from '../components/toasts/ConfirmToast';
import { ApplyAvailableUpdate, GetAvailableUpdate } from '../../../../wailsjs/go/main/App';

const UPDATE_AVAILABLE_EVENT = 'app:update-available';

export function useUpdateNotifier() {
  const confirmToast = useConfirmToast();
  const promptedVersion = useRef<string | null>(null);

  useEffect(() => {
    const askToUpdate = (version: string) => {
      if (!version || promptedVersion.current === version) return;
      promptedVersion.current = version;
      confirmToast({
        id: 'app-update-available',
        title: 'Aplicativo atualizado. Reinicie para usar a nova versão.',
        message: `Uma nova versão (${version}) está disponível. Deseja atualizar agora?`,
        onConfirm: () => ApplyAvailableUpdate(),
      });
    };

    GetAvailableUpdate().then(askToUpdate).catch(() => undefined);
    return EventsOn(UPDATE_AVAILABLE_EVENT, askToUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
