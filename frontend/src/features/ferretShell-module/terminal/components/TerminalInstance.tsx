import 'xterm/css/xterm.css';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import React, { useEffect, useRef } from 'react';
import { useTerminalStore } from '../TerminalStore';
import { EventsOn } from '../../../../../wailsjs/runtime/runtime';
import { TerminalInstance as ITerminalInstance } from '../../../../interfaces/TerminalInterfaces';
import { Send, Resize, Disconnect, ConnectWith, Broadcast } from '../../../../../wailsjs/go/ferretShellHandlers/TerminalHandlerStruct';

interface Props {
  instance: ITerminalInstance;
}

const TerminalInstance: React.FC<Props> = ({ instance }) => {
  const fitRef = useRef<FitAddon | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const { id, config } = instance;

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

    const sessionId = config?.SshSessionId || id;

    const handleData = (data: string) => {
      const state = useTerminalStore.getState();
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      const isActiveTab = activeTab?.instances.some(i => i.id === id);

      if (state.broadcastActive && isActiveTab && activeTab) {
        const sshSessionIds = activeTab.instances.filter(i => !i.containerId).map(i => i.config?.SshSessionId || i.id);
        if (sshSessionIds.length > 0) {
          Broadcast(sshSessionIds, data);
        }
      } else {
        Send(sessionId, data);
      }
    };

    terminal.onData(handleData);

    const offData = EventsOn(`ssh:data:${sessionId}`, (chunk: string) => terminal.write(chunk));
    const offExit = EventsOn(`ssh:exit:${sessionId}`, (msg: string) =>
      terminal.write(`\r\n[conexão encerrada] ${msg || ''}\r\n`)
    );

    ConnectWith({ ...(config as any), Cols: terminal.cols, Rows: terminal.rows }).catch(
      (event: any) => terminal.write(`\r\n[erro] ${String(event)}\r\n`)
    );

    const onResize = () => {
      fit.fit();
      Resize(sessionId, terminal.cols, terminal.rows);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(hostRef.current!);
    window.addEventListener('resize', onResize);

    return () => {
      Disconnect(sessionId);
      offData();
      offExit();
      terminal.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [id, config]);

  return (
    <div className="w-full h-full bg-[#0e172a] p-2 overflow-hidden">
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
};

export default TerminalInstance;
