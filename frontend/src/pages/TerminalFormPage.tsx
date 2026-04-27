import { Plus } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SshConnectionList from '../features/ferretShell-module/terminal/components/list/SshConnectionList';
import SshConnectionModal from '../features/ferretShell-module/terminal/components/modals/CreateSshConnectionModal';

const TerminalFormPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [reloadFlag, setReloadFlag] = useState(0);
  const { token, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="mx-auto max-w-4xl animate-pulse text-zinc-400">Carregando…</div>
      </div>
    );
  }
  if (!isAuthenticated || !token) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-300 bg-white p-6 text-sm text-gray-500 shadow-sm dark:border-white/10 dark:bg-zinc-800 dark:text-white">
          Sessão inválida. Faça login.
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Conexões SSH
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Gerencie acessos remotos e ative novos terminais.
          </p>
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[0.99] hover:bg-blue-700 hover:shadow-md sm:w-fit"
      >
        <Plus className="h-5 w-5" />
        Nova conexão
      </button>


      <SshConnectionList key={reloadFlag} token={token} />


      <SshConnectionModal
        onCreated={() => setReloadFlag((previous) => previous + 1)}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
};

export default TerminalFormPage;
