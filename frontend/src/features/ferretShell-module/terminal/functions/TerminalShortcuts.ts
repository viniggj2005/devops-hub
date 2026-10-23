import { Terminal } from '@xterm/xterm';
import { Clipboard } from '@wailsio/runtime';

const SUSPEND_SIGNAL = '\x1a';

export function attachTerminalShortcuts(terminal: Terminal, host: HTMLElement): () => void {
  const copySelection = () => {
    const text = terminal.getSelection();
    if (!text) return;
    Clipboard.SetText(text);
    terminal.clearSelection();
  };

  const pasteClipboard = async () => {
    const text = await Clipboard.Text();
    if (text) terminal.paste(text);
  };

  terminal.attachCustomKeyEventHandler((event) => {
    const ctrlOnly = event.ctrlKey && !event.altKey && !event.metaKey;
    if (!ctrlOnly) return true;

    const key = event.key.toLowerCase();
    const isCopy = key === 'c' && (event.shiftKey || terminal.hasSelection());
    const isPaste = key === 'v';
    const isSuspend = key === 'z' && !event.shiftKey;
    if (!isCopy && !isPaste && !isSuspend) return true;

    event.preventDefault();
    if (event.type === 'keydown') {
      if (isCopy) copySelection();
      else if (isPaste) pasteClipboard();
      else terminal.input(SUSPEND_SIGNAL);
    }
    return false;
  });

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    if (terminal.hasSelection()) copySelection();
    else pasteClipboard();
  };

  host.addEventListener('contextmenu', onContextMenu);
  return () => host.removeEventListener('contextmenu', onContextMenu);
}
