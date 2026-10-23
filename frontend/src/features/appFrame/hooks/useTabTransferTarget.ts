import { useEffect, useState } from 'react';
import { Events } from '@wailsio/runtime';
import { useAppStore } from '../AppStore';
import { adoptModuleHandoff } from '../ModuleHandoff';
import { claimModuleHandoffApi } from '../services/WindowService';
import { detachedModule, isDetachableModule } from '../WindowContext';

const tabAttachEvent = 'app:tab-attach';
const tabDropHoverEvent = 'app:tab-drop-hover';
const dropHighlightTimeoutMs = 1000;

let initialHandoffClaimed = false;

const claimInitialHandoff = () => {
  const module = detachedModule;
  if (initialHandoffClaimed || !module) return;
  initialHandoffClaimed = true;
  claimModuleHandoffApi()
    .then(payload => adoptModuleHandoff(module, payload))
    .catch(() => undefined);
};

export function useTabTransferTarget() {
  const openTab = useAppStore(state => state.openTab);
  const [dropHighlighted, setDropHighlighted] = useState(false);

  useEffect(() => {
    claimInitialHandoff();
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
      if (!isDetachableModule(data?.module)) return;
      openTab(data.module);
      adoptModuleHandoff(data.module, data.handoff);
    });

    return () => {
      clearHighlight();
      offHover();
      offAttach();
    };
  }, [openTab]);

  return dropHighlighted;
}
