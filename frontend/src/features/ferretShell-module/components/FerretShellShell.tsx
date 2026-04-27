import React from 'react';
import FerretShellNavbar from './FerretShellNavbar';
import { useTerminalStore } from '../terminal/TerminalStore';
import TerminalTabArea from '../terminal/components/TerminalTabArea';
import PasswordModal from '../terminal/components/modals/PasswordModal';

interface FerretShellShellProps {
    children: React.ReactNode;
}

const FerretShellShell: React.FC<FerretShellShellProps> = ({ children }) => {
    const { tabs, askPassword, submitPassword, viewMode } = useTerminalStore();
    const hasTabs = tabs.length > 0;

    return (
        <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] transition-colors duration-200">
            <FerretShellNavbar />
            <main className="flex-1 overflow-hidden flex flex-col relative">
                <div className={`absolute inset-0 overflow-auto transition-opacity duration-300 ${viewMode === 'page' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {children}
                    </div>
                </div>

                <div className={`absolute inset-0 p-4 transition-opacity duration-300 ${viewMode === 'terminal' && hasTabs ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                    <TerminalTabArea />
                </div>
            </main>

            <PasswordModal
                open={askPassword}
                onClose={() => useTerminalStore.getState().close()}
                onSubmit={(pwd) => submitPassword(pwd)}
            />
        </div>
    );
};

export default FerretShellShell;
