import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import TerminalModal from './components/modals/TerminalModal';
import PasswordModal from './components/modals/PasswordModal';
import { TerminalServices, toSshConn } from './services/TerminalServices';
import { OpenTerminalProps, SSHConnectionDto } from '../../../interfaces/TerminalInterfaces';

export default function SshTerminal({ id, onClose, autoOpen = true }: OpenTerminalProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [askPassword, setAskPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configure, setConfigure] = useState<SSHConnectionDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError('Sessão inválida');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        const connection = await TerminalServices.getById(token, id);
        const ssh = toSshConn(connection);

        if (!cancelled) {
          setConfigure(ssh);

          const hasKey = connection.key && connection.key.length > 0;
          if (!hasKey) {
            setAskPassword(true);
          } else if (autoOpen) {
            setOpen(true);
          }
        }
      } catch (error: any) {
        if (!cancelled) setError(error?.message ?? 'Falha ao carregar conexão');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token, autoOpen]);

  const handlePasswordSubmit = (password: string) => {
    setConfigure((previous) => ({ ...previous!, Password: password }));
    setAskPassword(false);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  if (loading)
    return (
      <button className="rounded-lg border px-3 py-2 text-sm" disabled>
        Abrindo…
      </button>
    );
  if (error) return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>;
  if (!configure && !askPassword) return null;

  return (
    <>
      {!autoOpen && !askPassword && (
        <button onClick={() => setOpen(true)} className="rounded-lg border px-3 py-2 text-sm">
          Abrir terminal
        </button>
      )}
      {configure && <TerminalModal open={open} onClose={handleClose} configure={configure} />}
      <PasswordModal
        open={askPassword}
        onClose={() => setAskPassword(false)}
        onSubmit={handlePasswordSubmit}
      />
    </>
  );
}
