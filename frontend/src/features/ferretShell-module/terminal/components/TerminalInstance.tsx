import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import React, { useEffect, useRef } from 'react';
import { useTerminalStore } from '../TerminalStore';
import { EventsOn } from '../../../../../wailsjs/runtime/runtime';
import { attachTerminalShortcuts } from '../functions/TerminalShortcuts';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';
import { TerminalThemeConfig } from '../../../../interfaces/GeneralConfigsInterfaces';
import { TerminalInstance as ITerminalInstance } from '../../../../interfaces/TerminalInterfaces';
import { Send, Resize, Disconnect, ConnectWith, Broadcast } from '../../../../../wailsjs/go/ferretshellHandlers/TerminalHandlerStruct';

interface Props {
  instance: ITerminalInstance;
}

const TerminalInstance: React.FC<Props> = ({ instance }) => {
  const fitRef = useRef<FitAddon | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appliedThemeRef = useRef<TerminalThemeConfig | null>(null);
  const terminalTheme = useGeneralConfigsStore(state => state.terminalTheme);

  const { id, config } = instance;

  useEffect(() => {
    const initialTheme = useGeneralConfigsStore.getState().terminalTheme;
    appliedThemeRef.current = initialTheme;
    const terminal = new Terminal({
      lineHeight: 1,
      convertEol: true,
      scrollback: 5000,
      cursorBlink: true,
      allowProposedApi: true,
      fontFamily: 'Courier New',
      theme: initialTheme.colors,
      fontSize: initialTheme.fontSize,
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
      const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
      const isActiveTab = activeTab?.instances.some(tabInstance => tabInstance.id === id);

      if (state.broadcastActive && isActiveTab && activeTab) {
        const sshSessionIds = activeTab.instances.filter(tabInstance => !tabInstance.containerId).map(tabInstance => tabInstance.config?.SshSessionId || tabInstance.id);
        if (sshSessionIds.length > 0) {
          Broadcast(sshSessionIds, data);
        }
      } else {
        Send(sessionId, data);
      }
    };

    terminal.onData(handleData);
    const detachShortcuts = attachTerminalShortcuts(terminal, hostRef.current!);

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
      detachShortcuts();
      terminal.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [id, config]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || appliedThemeRef.current === terminalTheme) return;
    appliedThemeRef.current = terminalTheme;
    terminal.options.theme = terminalTheme.colors;
    terminal.options.fontSize = terminalTheme.fontSize;
    fitRef.current?.fit();
    Resize(config?.SshSessionId || id, terminal.cols, terminal.rows).catch(() => undefined);
  }, [terminalTheme, config, id]);

  return (
    <div style={{ backgroundColor: terminalTheme.colors.background }} className="w-full h-full p-2 overflow-hidden">
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
};

export default TerminalInstance;
