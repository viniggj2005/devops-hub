import React from 'react';
import { Box, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ManagementCards: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div onClick={() => navigate('/containers')} className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-white dark:bg-white/10 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/20 group-hover:border-blue-500/50 dark:group-hover:border-white/30 transition-all shadow-sm hover:shadow-md" />
                <div className="relative p-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                        <Box className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-gray-900 dark:text-white mb-2 font-bold text-xl">Gerencie containers</h2>
                    <p className="text-gray-600 dark:text-white/70 mb-6">
                        Acesse o painel completo para iniciar, pausar ou remover containers a qualquer momento.
                    </p>
                    <button className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all font-medium">
                        Acessar containers
                    </button>
                </div>
            </div>

            <div onClick={() => navigate('/images')} className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-white dark:bg-white/10 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/20 group-hover:border-purple-500/50 dark:group-hover:border-white/30 transition-all shadow-sm hover:shadow-md" />
                <div className="relative p-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                        <Image className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-gray-900 dark:text-white mb-2 font-bold text-xl">Gerencie imagens</h2>
                    <p className="text-gray-600 dark:text-white/70 mb-6">
                        Filtre e escolha imagens rapidamente para manter seu ambiente organizado.
                    </p>
                    <button className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all font-medium">
                        Acessar imagens
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManagementCards;
