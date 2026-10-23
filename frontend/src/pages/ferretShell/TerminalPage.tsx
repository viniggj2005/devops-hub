import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Laptop, Plus, Search, Server, X } from 'lucide-react';
import LocalShellList from '../../features/ferretShell-module/terminal/components/LocalShellList';
import { useLocalShells } from '../../features/ferretShell-module/terminal/functions/useLocalShells';
import SshConnectionList from '../../features/ferretShell-module/terminal/components/SshConnectionList';
import CreateSshConnectionModal from '../../features/ferretShell-module/terminal/components/CreateSshConnectionModal';

const TerminalPage: React.FC = () => {
    const { token } = useAuth();
    const [search, setSearch] = useState('');
    const [reloadFlag, setReloadFlag] = useState(0);
    const { shells, loading, openShell } = useLocalShells();
    const [createModalOpen, setCreateModalOpen] = useState(false);

    return (
        <div className="space-y-8 pb-16">
            <section className="bg-white dark:bg-zinc-900/30 border border-gray-200 dark:border-white/5 rounded-3xl p-6 sm:p-8">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl shrink-0">
                        <Laptop className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                            Terminal local
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">
                            Abra um shell desta máquina em uma nova aba.
                        </p>
                    </div>
                </div>

                <LocalShellList shells={shells} loading={loading} onOpen={openShell} />
            </section>

            <section className="bg-white dark:bg-zinc-900/30 border border-gray-200 dark:border-white/5 rounded-3xl p-6 sm:p-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
                            <Server className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                Meus Servidores
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">
                                Selecione um servidor para iniciar uma sessão SSH em aba.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar servidor ou IP..."
                                className="w-full h-10 pl-9 pr-8 rounded-xl text-xs outline-none border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:border-purple-500"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => setCreateModalOpen(true)}
                            className="h-10 px-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            Nova Conexão
                        </button>
                    </div>
                </div>

                <SshConnectionList
                    key={reloadFlag}
                    search={search}
                    token={token || ''}
                    onCreateClick={() => setCreateModalOpen(true)}
                />
            </section>

            <CreateSshConnectionModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onCreated={() => setReloadFlag((previous) => previous + 1)}
            />
        </div>
    );
};

export default TerminalPage;
