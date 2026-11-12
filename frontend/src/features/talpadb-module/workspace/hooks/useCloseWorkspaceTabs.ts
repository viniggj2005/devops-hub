import { useTalpadbStore } from '../../TalpadbStore';
import { useTranslation } from '../../../i18n/useTranslation';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';
import type { WorkspaceGroup, WorkspaceTab } from '../../../../interfaces/TalpadbInterfaces';

const hasOpenTransaction = (status: string | undefined) => status === 'transaction' || status === 'failed';

export function useCloseWorkspaceTabs() {
  const confirmToast = useConfirmToast();
  const { dictionary, formatMessage } = useTranslation();
  const workspaceTexts = dictionary.talpadb.workspace;
  const tabs = useTalpadbStore((state) => state.tabs);
  const closeTab = useTalpadbStore((state) => state.closeTab);
  const closeGroup = useTalpadbStore((state) => state.closeGroup);
  const tabTxStatus = useTalpadbStore((state) => state.tabTxStatus);

  const closePane = (tab: WorkspaceTab) => {
    if (!hasOpenTransaction(tabTxStatus[tab.id])) {
      closeTab(tab.id);
      return;
    }
    confirmToast({
      id: `close-${tab.id}`,
      title: formatMessage(workspaceTexts.tabClosed, { title: tab.title }),
      message: formatMessage(workspaceTexts.openTransactionMessage, { title: tab.title }),
      onConfirm: () => closeTab(tab.id),
    });
  };

  const closeWholeGroup = (group: WorkspaceGroup) => {
    const pending = tabs.filter((tab) => group.paneIds.includes(tab.id) && hasOpenTransaction(tabTxStatus[tab.id]));
    if (pending.length === 0) {
      closeGroup(group.id);
      return;
    }
    confirmToast({
      id: `close-group-${group.id}`,
      title: workspaceTexts.tabsClosed,
      message: formatMessage(
        pending.length === 1 ? workspaceTexts.groupTransactionOne : workspaceTexts.groupTransactionOther,
        { titles: pending.map((tab) => `"${tab.title}"`).join(', ') }
      ),
      onConfirm: () => closeGroup(group.id),
    });
  };

  return { closePane, closeWholeGroup };
}
