import iziToast from 'izitoast';
import React, { useEffect } from 'react';
import PostgresNavbar from './PostgresNavbar';
import { usePostgresStore } from '../PostgresStore';
import PostgresHomePage from '../home/PostgresHomePage';
import WorkspacePage from '../workspace/WorkspacePage';
import { PostgresServices } from '../services/PostgresServices';
import { errorMessage } from '../functions/TreatmentFunctions';
import { getToken, useAuth } from '../../../contexts/AuthContext';
import { useExplorerStore } from '../workspace/explorer/ExplorerStore';

const PostgresModuleWrapper: React.FC = () => {
  const { token } = useAuth();
  const view = usePostgresStore((state) => state.view);

  useEffect(() => {
    if (!token) return;
    usePostgresStore
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
      if (currentToken) PostgresServices.disconnectAll(currentToken).catch(() => undefined);
      usePostgresStore.getState().reset();
      useExplorerStore.getState().reset();
    },
    []
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] transition-colors duration-200">
      <PostgresNavbar />
      <main className="flex-1 min-h-0 relative">
        <div
          className={`absolute inset-0 overflow-auto transition-opacity duration-300 ${
            view === 'home' ? 'opacity-100' : 'opacity-0 invisible'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PostgresHomePage />
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

export default PostgresModuleWrapper;
