import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import React, { useEffect, useRef } from 'react';
import { TerminalInstance as ITerminalInstance } from '../../../interfaces/TerminalInterfaces';
import { useDockerClient } from '../../../contexts/DockerClientContext';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime/runtime';
import { containerExec, terminalWrite } from '../../docker-module/containers/services/ContainersService';
import { Send, Resize, Disconnect, ConnectWith, Broadcast } from '../../../../wailsjs/go/handlers/TerminalHandlerStruct';
import { useTerminalStore } from './TerminalStore';
import iziToast from 'izitoast';

interface Props {
  instance: ITerminalInstance;
}

const TerminalInstance: React.FC<Props> = ({ instance }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const connectedRef = useRef(false);
  const { selectedCredentialId } = useDockerClient();

  const { id, config, containerId } = instance;

  useEffect(() => {
    const terminal = new Terminal({
      fontSize: 14,
      lineHeight: 1,
      convertEol: true,
      scrollback: 5000,
      cursorBlink: true,
      allowProposedApi: true,
      fontFamily: 'Courier New',
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

    let offData: any;
    let offExit: any;

    const handleData = (data: string) => {
      if (containerId && !connectedRef.current) return;

      const state = useTerminalStore.getState();
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      const isActiveTab = activeTab?.instances.some(i => i.id === id);

      if (state.broadcastActive && isActiveTab && activeTab) {
         const sshSessionIds = activeTab.instances.filter(i => !i.containerId).map(i => i.config?.SshSessionId || i.id);
         const containerIds = activeTab.instances.filter(i => i.containerId).map(i => i.containerId as string);
         
         if (sshSessionIds.length > 0) {
            Broadcast(sshSessionIds, data);
         }
         containerIds.forEach(cId => {
             terminalWrite(cId, data).catch((error: any) => console.error(error));
         });
      } else {
         if (!containerId) {
             const sessionId = config?.SshSessionId || id;
             Send(sessionId, data);
         } else {
             terminalWrite(containerId, data).catch((error: any) => console.error(error));
         }
      }
    };

    terminal.onData(handleData);

    if (!containerId) {
      const sessionId = config?.SshSessionId || id;
      offData = EventsOn(`ssh:data:${sessionId}`, (chunk: string) => terminal.write(chunk));
      offExit = EventsOn(`ssh:exit:${sessionId}`, (msg: string) =>
        terminal.write(`\r\n[conexão encerrada] ${msg || ''}\r\n`)
      );

      ConnectWith({ ...(config as any), Cols: terminal.cols, Rows: terminal.rows }).catch(
        (event: any) => terminal.write(`\r\n[erro] ${String(event)}\r\n`)
      );
    } else {
      EventsOn(`terminal:data:${containerId}`, (data: string) => {
        terminal.write(data);
      });

      EventsOn(`terminal:closed:${containerId}`, () => {
        terminal.writeln('\r\nConnection closed by remote host.');
        connectedRef.current = false;
      });

      (async () => {
        try {
          if (!selectedCredentialId) return;
          await containerExec(selectedCredentialId, containerId);
          connectedRef.current = true;
          terminal.clear();
          fit.fit();
          terminal.focus();
        } catch (error: any) {
          terminal.writeln(`\r\nError connecting: ${error?.message || error}`);
          iziToast.error({ title: 'Erro', message: error?.message || String(error) });
        }
      })();
    }

    const onResize = () => {
      fit.fit();
      const sessionId = config?.SshSessionId || id;
      Resize(sessionId, terminal.cols, terminal.rows);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(hostRef.current!);

    window.addEventListener('resize', onResize);

    return () => {
      const sessionId = config?.SshSessionId || id;
      Disconnect(sessionId);
      terminal.dispose();
      if (!containerId) {
        offData && offData();
        offExit && offExit();
        EventsOff(`ssh:data:${sessionId}`);
        EventsOff(`ssh:exit:${sessionId}`);
      } else {
        EventsOff(`terminal:data:${containerId}`);
        EventsOff(`terminal:closed:${containerId}`);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [id, config, containerId, selectedCredentialId]);

  return (
    <div className="w-full h-full bg-[#0e172a] p-2 overflow-hidden">
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
};

export default TerminalInstance;
