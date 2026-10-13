import { usePostgresStore } from '../../PostgresStore';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';
import type { WorkspaceGroup, WorkspaceTab } from '../../../../interfaces/PostgresInterfaces';

const hasOpenTransaction = (status: string | undefined) => status === 'transaction' || status === 'failed';

export function useCloseWorkspaceTabs() {
  const confirmToast = useConfirmToast();
  const tabs = usePostgresStore((state) => state.tabs);
  const closeTab = usePostgresStore((state) => state.closeTab);
  const closeGroup = usePostgresStore((state) => state.closeGroup);
  const tabTxStatus = usePostgresStore((state) => state.tabTxStatus);

  const closePane = (tab: WorkspaceTab) => {
    if (!hasOpenTransaction(tabTxStatus[tab.id])) {
      closeTab(tab.id);
      return;
    }
    confirmToast({
      id: `close-${tab.id}`,
      title: `Aba ${tab.title} fechada`,
      message: `"${tab.title}" tem uma transação aberta. Fechar a aba descarta (ROLLBACK) as alterações não confirmadas. Fechar mesmo assim?`,
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
      title: 'Abas fechadas',
      message: `${pending.map((tab) => `"${tab.title}"`).join(', ')} ${pending.length === 1 ? 'tem uma transação aberta' : 'têm transações abertas'}. Fechar descarta (ROLLBACK) as alterações não confirmadas. Fechar mesmo assim?`,
      onConfirm: () => closeGroup(group.id),
    });
  };

  return { closePane, closeWholeGroup };
}
