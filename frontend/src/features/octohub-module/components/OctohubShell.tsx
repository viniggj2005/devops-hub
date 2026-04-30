import React from 'react';
import OctohubNavbar from './OctohubNavbar';

interface OctohubShellProps {
    children: React.ReactNode;
    isLoggedIn: boolean | null;
}

const OctohubShell: React.FC<OctohubShellProps> = ({ children, isLoggedIn }) => {
    return (
        <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] transition-colors duration-200">
            <OctohubNavbar isLoggedIn={isLoggedIn} />
            <main className="flex-1 overflow-auto relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default OctohubShell;
