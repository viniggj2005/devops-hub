import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Shield, Terminal, Server } from 'lucide-react';
import SshConnectionList from './components/SshConnectionList';
import SshConnectionModal from './components/CreateSshConnectionModal';

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
    <div className="space-y-12 pb-20">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-transparent border border-blue-500/10 p-8 md:p-12">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-6">
            <Shield className="w-3 h-3" />
            Configurações de Acesso
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight">
            Gerencie suas <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Conexões SSH</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-zinc-400 mb-8 leading-relaxed">
            Adicione, edite e organize seus acessos remotos. Todos os seus servidores em um só lugar, prontos para conexão imediata.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setOpen(true)}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/25 hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nova Conexão
            </button>
          </div>
        </div>
        <div className="absolute top-1/2 right-0 -translate-y-1/2 opacity-10 dark:opacity-20 hidden lg:block">
          <Terminal className="w-96 h-96 text-blue-600" />
        </div>
      </section>

      <section className="bg-white dark:bg-zinc-900/30 border border-gray-200 dark:border-white/5 rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Conexões Ativas</h2>
            <p className="text-gray-500 dark:text-zinc-400">Lista completa de servidores configurados no seu perfil.</p>
          </div>
        </div>

        <SshConnectionList key={reloadFlag} token={token} />
      </section>

      <SshConnectionModal
        onCreated={() => setReloadFlag((previous) => previous + 1)}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
};

export default TerminalFormPage;
