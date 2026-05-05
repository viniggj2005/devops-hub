import React from 'react';
import OctohubNavbar from './OctohubNavbar';

interface OctohubShellProps {
    children: React.ReactNode;
    isLoggedIn: boolean | null;
}

const OctohubShell: React.FC<OctohubShellProps> = ({ children, isLoggedIn }) => {
    return (
        <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] transition-colors duration-200 overflow-hidden">
            <OctohubNavbar isLoggedIn={isLoggedIn} />
            <main className="flex-1 relative min-h-0">
                <div className="w-full h-full">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default OctohubShell;
