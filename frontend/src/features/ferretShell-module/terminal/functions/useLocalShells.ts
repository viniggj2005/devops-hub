import { useTerminalStore } from '../TerminalStore';
import { useCallback, useEffect, useState } from 'react';
import { LocalShell } from '../../../../interfaces/TerminalInterfaces';
import { ListShells } from '../../../../../wailsjs/go/ferretshellHandlers/LocalTerminalHandlerStruct';

let cachedShellsRequest: Promise<LocalShell[]> | null = null;

const fetchLocalShells = () => {
  if (!cachedShellsRequest) {
    cachedShellsRequest = ListShells()
      .then(shells => (shells ?? []) as LocalShell[])
      .catch(() => {
        cachedShellsRequest = null;
        return [];
      });
  }
  return cachedShellsRequest;
};

export const useLocalShells = () => {
  const [loading, setLoading] = useState(true);
  const [shells, setShells] = useState<LocalShell[]>([]);
  const createTab = useTerminalStore(state => state.createTab);

  useEffect(() => {
    let isMounted = true;
    fetchLocalShells().then(detectedShells => {
      if (!isMounted) return;
      setShells(detectedShells);
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const openShell = useCallback(
    (shell: LocalShell) => createTab({ title: shell.name, localShell: shell }),
    [createTab]
  );

  const defaultShell = shells.find(shell => shell.isDefault) ?? shells[0];

  return { shells, loading, defaultShell, openShell };
};
