import { useEffect, useState } from 'react';
import { Events } from '@wailsio/runtime';
import { useAppStore } from '../AppStore';
import { isDetachableModule } from '../WindowContext';

const tabAttachEvent = 'app:tab-attach';
const tabDropHoverEvent = 'app:tab-drop-hover';
const dropHighlightTimeoutMs = 1000;

export function useTabTransferTarget() {
  const openTab = useAppStore(state => state.openTab);
  const [dropHighlighted, setDropHighlighted] = useState(false);

  useEffect(() => {
    let highlightTimeout: number | undefined;

    const clearHighlight = () => {
      window.clearTimeout(highlightTimeout);
      setDropHighlighted(false);
    };

    const offHover = Events.On(tabDropHoverEvent, ({ data: active }) => {
      clearHighlight();
      if (!active) return;
      setDropHighlighted(true);
      highlightTimeout = window.setTimeout(clearHighlight, dropHighlightTimeoutMs);
    });

    const offAttach = Events.On(tabAttachEvent, ({ data }) => {
      clearHighlight();
      if (isDetachableModule(data?.module)) openTab(data.module);
    });

    return () => {
      clearHighlight();
      offHover();
      offAttach();
    };
  }, [openTab]);

  return dropHighlighted;
}
