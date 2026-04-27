import { createPortal } from 'react-dom';
import { useTerminalStore } from './TerminalStore';
import TerminalModal from './components/modals/TerminalModal';
import PasswordModal from './components/modals/PasswordModal';

function ensureRoot(): HTMLElement {
  let terminalElement = document.getElementById('terminal-root') as HTMLElement | null;
  if (!terminalElement) {
    terminalElement = document.createElement('div');
    terminalElement.id = 'terminal-root';
    document.body.appendChild(terminalElement);
  }
  return terminalElement;
}

export default function GlobalTerminalHost() {
  const root = ensureRoot();
  const { open, config, containerId, containerName, askPassword, close, submitPassword, minimized, minimize } = useTerminalStore();

  const isSsh = !!config;
  const isContainer = !!containerId;

  return createPortal(
    <>
      {open && (isSsh || isContainer) && (
        <TerminalModal
          open={true}
          onClose={close}
          minimized={minimized}
          onMinimize={minimize}
          configure={config || undefined}
          id={containerId || undefined}
          title={isContainer ? `Terminal: ${containerName}` : (config ? `${config.User}@${config.Host}` : 'Terminal SSH')}
        />
      )}
      <PasswordModal open={askPassword} onClose={close} onSubmit={(pwd) => submitPassword(pwd)} />
    </>,
    root
  );
}
