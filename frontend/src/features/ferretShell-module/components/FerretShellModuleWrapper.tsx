import SftpPage from '../sftp/SftpPage';
import FerretShellShell from './FerretShellShell';
import TerminalPage from '../terminal/TerminalPage';
import { Routes, Route, Navigate } from 'react-router-dom';
import TerminalFormPage from '../terminal/TerminalFormPage';

const FerretShellModuleWrapper: React.FC = () => {
    return (
        <FerretShellShell>
            <Routes>
                <Route path="/term/sftp" element={<SftpPage />} />
                <Route path="/term/home" element={<TerminalPage />} />
                <Route path="/" element={<Navigate to="/term/home" replace />} />
                <Route path="/term" element={<Navigate to="/term/home" replace />} />
                <Route path="/term/createConnectionForm" element={<TerminalFormPage />} />
            </Routes>
        </FerretShellShell>
    );
};

export default FerretShellModuleWrapper;
