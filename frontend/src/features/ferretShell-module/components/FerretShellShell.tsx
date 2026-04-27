import React from 'react';
import FerretShellNavbar from './FerretShellNavbar';

interface FerretShellShellProps {
    children: React.ReactNode;
}

const FerretShellShell: React.FC<FerretShellShellProps> = ({ children }) => {
    return (
        <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] transition-colors duration-200">
            <FerretShellNavbar />
            <main className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default FerretShellShell;
