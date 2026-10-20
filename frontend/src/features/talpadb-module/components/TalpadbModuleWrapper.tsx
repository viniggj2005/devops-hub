import iziToast from 'izitoast';
import React, { useEffect } from 'react';
import TalpadbNavbar from './TalpadbNavbar';
import { useTalpadbStore } from '../TalpadbStore';
import TalpadbHomePage from '../home/TalpadbHomePage';
import WorkspacePage from '../workspace/WorkspacePage';
import { TalpadbServices } from '../services/TalpadbServices';
import { errorMessage } from '../functions/TreatmentFunctions';
import { getToken, useAuth } from '../../../contexts/AuthContext';
import { useExplorerStore } from '../workspace/explorer/ExplorerStore';

const TalpadbModuleWrapper: React.FC = () => {
  const { token } = useAuth();
  const view = useTalpadbStore((state) => state.view);

  useEffect(() => {
    if (!token) return;
    useTalpadbStore
      .getState()
      .loadConnections(token)
      .then((connections) => useExplorerStore.getState().syncServers(connections))
      .catch((error) =>
        iziToast.error({
          title: 'Erro',
          message: `Erro ao carregar conexões: ${errorMessage(error)}`,
          position: 'bottomRight',
        })
      );
  }, [token]);

  // Fechar a aba do módulo encerra todas as conexões abertas por ele.
  useEffect(
    () => () => {
      const currentToken = getToken();
      if (currentToken) TalpadbServices.disconnectAll(currentToken).catch(() => undefined);
      useTalpadbStore.getState().reset();
      useExplorerStore.getState().reset();
    },
    []
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] transition-colors duration-200">
      <TalpadbNavbar />
      <main className="flex-1 min-h-0 relative">
        <div
          className={`absolute inset-0 overflow-auto transition-opacity duration-300 ${
            view === 'home' ? 'opacity-100' : 'opacity-0 invisible'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <TalpadbHomePage />
          </div>
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            view === 'workspace' ? 'opacity-100' : 'opacity-0 invisible'
          }`}
        >
          <WorkspacePage />
        </div>
      </main>
    </div>
  );
};

export default TalpadbModuleWrapper;
