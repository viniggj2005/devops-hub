import React from 'react';
import { Plus, Server } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ConnectServerCard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="relative">
            <div className="absolute inset-0 bg-white dark:bg-white/10 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/20 shadow-sm" />
            <div className="relative p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Server className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-gray-900 dark:text-white mb-2 font-bold text-xl">Precisa conectar em um servidor?</h2>
                            <p className="text-gray-600 dark:text-white/70">
                                Crie uma nova conexão SSH e gerencie seus terminais com rapidez.
                            </p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/createConnectionForm')} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all flex items-center gap-2 whitespace-nowrap font-medium">
                        <Plus className="w-5 h-5" />
                        Criar conexão SSH
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConnectServerCard;
