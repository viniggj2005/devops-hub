import 'xterm/css/xterm.css';
import iziToast from 'izitoast';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, SquareTerminal } from 'lucide-react';
import TerminalModalHeader from '../headers/TerminalModalHeader';
import { TerminalProps } from '../../../../../interfaces/TerminalInterfaces';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import { EventsOff, EventsOn } from '../../../../../../wailsjs/runtime/runtime';
import { containerExec, terminalWrite } from '../../../../docker-module/containers/services/ContainersService';
import { Send, Resize, Disconnect, ConnectWith } from '../../../../../../wailsjs/go/handlers/TerminalHandlerStruct';

const TerminalModal: React.FC<TerminalProps> = ({
  id,
  open,
  onClose,
  configure,
  onMinimize,
  minimized = false,
  title = 'Terminal SSH',
}) => {
  const dragRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [miniPos, setMiniPos] = useState({ x: 40, y: 40 });

  useEffect(() => {
    if (!minimized) return;

    const width = 200;
    const height = 50;
    const padding = 20;

    const handleResize = () => {
      setMiniPos({
        x: window.innerWidth - width - padding,
        y: window.innerHeight - height - padding,
      });
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [minimized]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!dragRef.current) return;
      setMiniPos({
        x: event.clientX - dragStartRef.current.x,
        y: event.clientY - dragStartRef.current.y,
      });
    };

    const up = () => {
      dragRef.current = false;
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const startYRef = useRef(0);
  const startHRef = useRef(420);
  const resizingRef = useRef(false);

  const connectedRef = useRef(false);
  const { selectedCredentialId } = useDockerClient();

  const [docked, setDocked] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [dockHeight, setDockHeight] = useState(420);

  const fitRef = useRef<FitAddon | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setDockHeight(Math.round(window.innerHeight * 0.45));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const terminal = new Terminal({
      fontSize: 14
      ,
      lineHeight: 1,
      convertEol: true,
      scrollback: 5000,
      cursorBlink: true,
      allowProposedApi: true,
      fontFamily: 'Courier New',
      cursorInactiveStyle: 'none',
      theme: {
        background: '#0e172a',
        foreground: '#d1d5db',
        cursor: '#734fa6',

        green: '#4ade80',
        brightGreen: '#4ade80',
      },
    });

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && !event.shiftKey && (event.key === 'v' || event.key === 'V')) {
        event.preventDefault();
        if (navigator.clipboard?.readText) {
          navigator.clipboard
            .readText()
            .then((text) => {
              if (!text) return;
              const anyTerm = terminal as any;
              if (typeof anyTerm.paste === 'function') {
                anyTerm.paste(text);
              } else {
                terminal.write(text);
                Send(configure?.SshSessionId || '', text);
              }
            })
            .catch(() => {
            });
        }
        return false;
      }

      if (event.ctrlKey && !event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        const selection = terminal.getSelection();
        if (selection) {
          event.preventDefault();
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(selection).catch(() => { });
          }
          return false;
        }
        return true;
      }

      return true;
    });


    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(hostRef.current!);
    fit.fit();
    terminal.focus();

    fitRef.current = fit;
    terminalRef.current = terminal;
    let subscription: any;
    let offData: any;
    let offExit: any;
    if (!id) {
      subscription = terminal.onData((data: string) => Send(configure?.SshSessionId || '', data));
      offData = EventsOn('ssh:data', (chunk: string) => terminal.write(chunk));
      offExit = EventsOn('ssh:exit', (msg: string) =>
        terminal.write(`\r\n[conexão encerrada] ${msg || ''}\r\n`)
      );

      ConnectWith({ ...(configure as any), Cols: terminal.cols, Rows: terminal.rows }).catch(
        (event: any) => terminal.write(`\r\n[erro] ${String(event)}\r\n`)
      );
    } else if (id) {
      terminal.onData((data: string) => {
        if (connectedRef.current) {
          terminalWrite(id, data).catch((error: any) => console.error(error));
        }
      });

      EventsOn(`terminal:data:${id}`, (data: string) => {
        terminal.write(data);
      });

      EventsOn(`terminal:closed:${id}`, () => {
        terminal.writeln('\r\nConnection closed by remote host.');
        connectedRef.current = false;
      });

      (async () => {
        try {
          if (!selectedCredentialId) return;
          await containerExec(selectedCredentialId, id);
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


    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
      Resize(configure?.SshSessionId || '', terminal.cols, terminal.rows);
    });

    resizeObserver.observe(hostRef.current!);
    resizeObserverRef.current = resizeObserver;

    const onWindowResize = () => {
      fit.fit();
      Resize(configure?.SshSessionId || '', terminal.cols, terminal.rows);
    };

    window.addEventListener('resize', onWindowResize);

    return () => {
      Disconnect(configure?.SshSessionId || '');
      terminal.dispose();
      if (!id) {
        subscription.dispose();
        offData && offData();
        offExit && offExit();
      } else if (id) {
        EventsOff(`terminal:data:${id}`);
        EventsOff(`terminal:closed:${id}`);
      }
      resizeObserver.disconnect();

      fitRef.current = null;
      terminalRef.current = null;
      resizeObserverRef.current = null;

      window.removeEventListener('resize', onWindowResize);
    };
  }, [open, configure, id, selectedCredentialId]);

  useEffect(() => {
    if (!open || minimized) return;

    queueMicrotask(() => {
      if (fitRef.current && terminalRef.current) {
        fitRef.current.fit();
        Resize(configure?.SshSessionId || '', terminalRef.current.cols, terminalRef.current.rows);
      }
    });
  }, [maximized, docked, dockHeight, open, minimized]);

  if (!open) return null;

  const closeOnBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!docked && event.target === event.currentTarget) onClose();
  };

  const onDockGripDown = (event: React.MouseEvent<HTMLDivElement>) => {
    resizingRef.current = true;
    startYRef.current = event.clientY;
    startHRef.current = dockHeight;

    const onMove = (event: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - event.clientY;
      const next = Math.max(240, Math.min(window.innerHeight - 80, startHRef.current + delta));
      setDockHeight(next);
    };

    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const containerBase =
    'relative shadow-2xl overflow-hidden ';

  const modalSize =
    'w-[min(90vw,1100px)] h-[min(85vh,780px)] rounded-2xl ' +
    ' dark:text-white';

  const fullscreenSize = 'w-screen h-screen appframe-drag cursor-grab active:cursor-grabbing rounded-none border-0';

  const dockedSize =
    'w-screen rounded-t-2xl  ' +
    '';

  const containerClasses =
    containerBase + (maximized ? fullscreenSize : docked ? dockedSize : modalSize);

  const containerStyle: React.CSSProperties = {
    height: maximized ? '100vh' : docked ? dockHeight : undefined,
  };

  const backdropBase = 'fixed inset-0 z-50';

  const backdropClasses = minimized ? 'hidden' : `flex ${docked ? 'items-end justify-center pointer-events-none' : 'items-center justify-center backdrop-blur-sm'}`;

  return (
    <>
      {minimized && (
        <div
          style={{
            position: 'fixed',
            left: miniPos.x,
            top: miniPos.y,
            zIndex: 99999,
          }}
          className="group flex cursor-grab active:cursor-grabbing items-center gap-3 rounded-2xl border border-gray-200 bg-white/80 p-3 shadow-2xl backdrop-blur-xl transition-all hover:-translate-y-0.5 dark:border-white/10 dark:bg-zinc-900/80"
          onMouseDown={(event) => {
            dragRef.current = true;
            dragStartRef.current = { x: event.clientX - miniPos.x, y: event.clientY - miniPos.y };
          }}
        >
          <div className="flex items-center gap-3 pl-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
              <SquareTerminal className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 select-none">
              {title}
            </span>
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />

          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => onMinimize?.(false)}
            title="Restaurar"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        onClick={closeOnBackdrop}
        className={`${backdropBase} ${backdropClasses}`}
        aria-modal
        role="dialog"
        style={{ display: minimized ? 'none' : 'flex' }}
      >
        <div
          style={containerStyle}
          onClick={(event) => event.stopPropagation()}
          className={containerClasses + ' pointer-events-auto'}
        >
          {docked && !maximized && (
            <div
              onMouseDown={onDockGripDown}
              className="h-2 cursor-row-resize bg-transparent hover:scale-95 rounded-t-2xl"
              title="Arraste para redimensionar"
            />
          )}

          <TerminalModalHeader
            title={title}
            docked={docked}
            onClose={onClose}
            maximized={maximized}
            onToggleDock={() => setDocked((value) => !value)}
            onToggleMax={() => setMaximized((value) => !value)}
            onMinimize={() => onMinimize?.(true)}
          />

          <div className="flex h-[calc(100%-52px)] flex-col rounded-b-lg  mb-5 pb-5 bg-[#0e172a]">
            <div ref={hostRef} className="flex-1 min-h-0 w-full " />
          </div>
        </div>
      </div>
    </>
  );
};

export default TerminalModal;
