import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import React, { useEffect, useRef } from 'react';
import { useTerminalStore } from '../TerminalStore';
import { Events } from '@wailsio/runtime';
import { attachTerminalShortcuts } from '../functions/TerminalShortcuts';
import { resolveTerminalTransport } from '../functions/TerminalTransports';
import { useGeneralConfigsStore } from '../../../settings/store/GeneralConfigsStore';
import { TerminalThemeConfig } from '../../../../interfaces/GeneralConfigsInterfaces';
import { TerminalInstance as ITerminalInstance } from '../../../../interfaces/TerminalInterfaces';

const ANSI_RED = '31';
const ANSI_DIM = '2';
const ANSI_YELLOW = '33';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface Props {
  instance: ITerminalInstance;
}

const TerminalInstance: React.FC<Props> = ({ instance }) => {
  const fitRef = useRef<FitAddon | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appliedThemeRef = useRef<TerminalThemeConfig | null>(null);
  const terminalTheme = useGeneralConfigsStore(state => state.terminalTheme);

  const { id, config, localShell } = instance;

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

    const transport = resolveTerminalTransport(instance);

    let isDisposed = false;
    let connectionStatus: ConnectionStatus = 'connecting';

    const writeNotice = (color: string, label: string, message: string) => {
      if (isDisposed) return;
      terminal.write(`\r\n\x1b[${color}m[${label}]\x1b[0m ${message}\r\n`);
    };

    const markDisconnected = () => {
      connectionStatus = 'disconnected';
      writeNotice(ANSI_DIM, 'ferret', `pressione Enter para ${transport.restartAction}`);
    };

    const connect = () => {
      connectionStatus = 'connecting';
      transport.connect(terminal.cols, terminal.rows)
        .then(() => {
          connectionStatus = 'connected';
          if (isDisposed) return;
          fit.fit();
          transport.resize(terminal.cols, terminal.rows).catch(() => undefined);
        })
        .catch((connectError: unknown) => {
          if (isDisposed) return;
          writeNotice(ANSI_RED, 'erro', String(connectError));
          markDisconnected();
        });
    };

    const reconnect = () => {
      writeNotice(ANSI_YELLOW, 'ferret', `${transport.restartAction}...`);
      connect();
    };

    const handleData = (data: string) => {
      if (connectionStatus === 'disconnected') {
        if (data.includes('\r')) reconnect();
        return;
      }
      if (connectionStatus === 'connecting') return;

      const state = useTerminalStore.getState();
      const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
      const isActiveTab = activeTab?.instances.some(tabInstance => tabInstance.id === id);

      if (state.broadcastActive && isActiveTab && activeTab) {
        activeTab.instances
          .filter(tabInstance => !tabInstance.containerId)
          .forEach(tabInstance => resolveTerminalTransport(tabInstance).send(data).catch(() => undefined));
      } else {
        transport.send(data).catch(() => undefined);
      }
    };

    terminal.onData(handleData);
    const detachShortcuts = attachTerminalShortcuts(terminal, hostRef.current!);

    const offData = Events.On(transport.dataEvent, ({ data: chunk }) => terminal.write(chunk));
    const offExit = Events.On(transport.exitEvent, ({ data: reason }) => {
      if (connectionStatus === 'disconnected') return;
      writeNotice(ANSI_RED, transport.exitLabel, reason || 'sessão finalizada');
      markDisconnected();
    });

    connect();

    const onResize = () => {
      fit.fit();
      if (connectionStatus !== 'connected') return;
      transport.resize(terminal.cols, terminal.rows).catch(() => undefined);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(hostRef.current!);
    window.addEventListener('resize', onResize);

    return () => {
      isDisposed = true;
      transport.disconnect();
      offData();
      offExit();
      detachShortcuts();
      terminal.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [id, config, localShell]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || appliedThemeRef.current === terminalTheme) return;
    appliedThemeRef.current = terminalTheme;
    terminal.options.theme = terminalTheme.colors;
    terminal.options.fontSize = terminalTheme.fontSize;
    fitRef.current?.fit();
    resolveTerminalTransport(instance).resize(terminal.cols, terminal.rows).catch(() => undefined);
  }, [terminalTheme, instance]);

  return (
    <div style={{ backgroundColor: terminalTheme.colors.background }} className="w-full h-full p-2 overflow-hidden">
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
};

export default TerminalInstance;
