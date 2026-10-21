import React from 'react';
import OctohubNavbar from './OctohubNavbar';

interface OctohubShellProps {
    children: React.ReactNode;
    isLoggedIn: boolean | null;
    accountSwitcher?: React.ReactNode;
}

const OctohubShell: React.FC<OctohubShellProps> = ({ children, isLoggedIn, accountSwitcher }) => {
    return (
        <div
            onContextMenu={(event) => event.preventDefault()}
            className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-[#0a0a0c] transition-colors duration-200 overflow-hidden"
        >
            <OctohubNavbar isLoggedIn={isLoggedIn} accountSwitcher={accountSwitcher} />
            <main className="flex-1 relative min-h-0">
                <div className="w-full h-full">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default OctohubShell;
