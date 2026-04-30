import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../appFrame/AppStore';

interface OctohubNavbarProps {
    isLoggedIn: boolean | null;
}

const OctohubNavbar: React.FC<OctohubNavbarProps> = ({ isLoggedIn }) => {
    const { setActiveTab } = useAppStore();

    return (
        <nav className="h-16 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-20 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setActiveTab('home')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors group"
                    title="Voltar ao Console"
                >
                    <ChevronLeft className="w-5 h-5 text-gray-500 group-hover:text-emerald-500 transition-colors" />
                </button>
                <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-1" />
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <img src="/gitoctocat.svg" className="w-6 h-6 brightness-0 dark:invert" alt="OctoHub" />
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-500 block leading-none mb-1">Módulo</span>
                        <h1 className="text-lg font-bold leading-none">OctoHub</h1>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {isLoggedIn ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-sm font-medium">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        GitHub Conectado
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-500/10 text-gray-500 rounded-full text-sm font-medium">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        Desconectado
                    </div>
                )}
            </div>
        </nav>
    );
};

export default OctohubNavbar;
