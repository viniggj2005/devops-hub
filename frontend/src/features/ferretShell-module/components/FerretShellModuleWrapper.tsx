import React from 'react';
import SftpPage from '../../../pages/SftpPage';
import FerretShellShell from './FerretShellShell';
import { Routes, Route, Navigate } from 'react-router-dom';
import TerminalFormPage from '../../../pages/TerminalFormPage';
import FerretShellHomePage from '../../../pages/FerretShellHomePage';

const FerretShellModuleWrapper: React.FC = () => {
    return (
        <FerretShellShell>
            <Routes>
                <Route path="/term/sftp" element={<SftpPage />} />
                <Route path="/term/home" element={<FerretShellHomePage />} />
                <Route path="/" element={<Navigate to="/term/home" replace />} />
                <Route path="/term" element={<Navigate to="/term/home" replace />} />
                <Route path="/term/createConnectionForm" element={<TerminalFormPage />} />
            </Routes>
        </FerretShellShell>
    );
};

export default FerretShellModuleWrapper;
