import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import React, { useEffect, useRef } from 'react';
import { TerminalInstance } from '../../../../../interfaces/TerminalInterfaces';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { EventsOn } from '../../../../../../wailsjs/runtime/runtime';
import { containerExec, terminalWrite, terminalResize, terminalClose } from '../../services/ContainersService';
import iziToast from 'izitoast';

interface Props {
  instance: TerminalInstance;
}

const ContainerTerminal: React.FC<Props> = ({ instance }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const connectedRef = useRef(false);
  const { selectedCredentialId } = useDockerClient();

  const { containerId } = instance;

  useEffect(() => {
    if (!containerId) return;

    const terminal = new Terminal({
      fontSize: 14,
      lineHeight: 1.2,
      convertEol: true,
      scrollback: 5000,
      cursorBlink: true,
      allowProposedApi: true,
      fontFamily: 'Courier New, monospace',
      theme: {
        background: '#0e172a',
        foreground: '#d1d5db',
        cursor: '#734fa6',
        green: '#4ade80',
      },
    });

    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(hostRef.current!);
    fit.fit();
    terminal.focus();

    terminalRef.current = terminal;
    fitRef.current = fit;

    const handleData = (data: string) => {
      if (!connectedRef.current) return;
      terminalWrite(containerId, data).catch((error: any) => console.error(error));
    };

    terminal.onData(handleData);

    const offData = EventsOn(`terminal:data:${containerId}`, (data: string) => {
      terminal.write(data);
    });

    const offClosed = EventsOn(`terminal:closed:${containerId}`, () => {
      terminal.writeln('\r\n[conexão encerrada pelo servidor]');
      connectedRef.current = false;
    });

    (async () => {
      try {
        if (!selectedCredentialId) return;
        await containerExec(selectedCredentialId, containerId);
        connectedRef.current = true;
        fit.fit();
        terminal.focus();
        
        await terminalResize(selectedCredentialId, containerId, terminal.cols, terminal.rows);
      } catch (error: any) {
        terminal.writeln(`\r\nErro ao conectar: ${error?.message || error}`);
        iziToast.error({ title: 'Erro', message: error?.message || String(error) });
      }
    })();

    const onResize = () => {
      if (fitRef.current && terminalRef.current && selectedCredentialId && containerId) {
        fitRef.current.fit();
        terminalResize(selectedCredentialId, containerId, terminalRef.current.cols, terminalRef.current.rows)
          .catch(err => console.error('Resize error:', err));
      }
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(hostRef.current!);
    window.addEventListener('resize', onResize);

    return () => {
      offData();
      offClosed();
      terminalClose(containerId).catch(err => console.error('Close error:', err));
      terminal.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [containerId, selectedCredentialId]);

  return (
    <div className="w-full h-full bg-[#0e172a] p-1 overflow-hidden">
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
};

export default ContainerTerminal;
