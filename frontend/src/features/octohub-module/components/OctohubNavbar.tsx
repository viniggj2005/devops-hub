import React from 'react';
import ToggleThemeButton from '../../shared/components/buttons/ToggleThemeButton';

interface OctohubNavbarProps {
    isLoggedIn: boolean | null;
}

const OctohubNavbar: React.FC<OctohubNavbarProps> = ({ isLoggedIn }) => {

    return (
        <nav className="h-16 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-20 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <img src="/gitoctocat.svg" className="w-6 h-6 brightness-0 dark:invert" alt="OctoHub" />
                </div>
                <div>
                    <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-emerald-700 bg-clip-text text-transparent hidden sm:inline">OctoHub</span>
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
                <div className="flex items-center gap-4 flex-shrink-0 pl-4">
                    <ToggleThemeButton />
                </div>
            </div>

        </nav>
    );
};

export default OctohubNavbar;
