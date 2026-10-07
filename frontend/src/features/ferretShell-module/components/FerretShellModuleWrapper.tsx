import FerretShellShell from './FerretShellShell';
import SftpPage from '../../../pages/ferretShell/SftpPage';
import { Routes, Route, Navigate } from 'react-router-dom';
import TerminalPage from '../../../pages/ferretShell/TerminalPage';

const FerretShellModuleWrapper: React.FC = () => {
    return (
        <FerretShellShell>
            <Routes>
                <Route path="/term/sftp" element={<SftpPage />} />
                <Route path="/term/home" element={<TerminalPage />} />
                <Route path="/" element={<Navigate to="/term/home" replace />} />
                <Route path="/term" element={<Navigate to="/term/home" replace />} />
                <Route path="/term/createConnectionForm" element={<Navigate to="/term/home" replace />} />
            </Routes>
        </FerretShellShell>
    );
};

export default FerretShellModuleWrapper;
