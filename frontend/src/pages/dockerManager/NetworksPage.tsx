import toast from 'react-hot-toast';
import { currentDictionary } from '../../features/i18n/TranslateError';
import { useTranslation } from '../../features/i18n/useTranslation';
import { NetworkItem } from '../../interfaces/NetworkInterfaces';
import { useDockerClient } from '../../contexts/DockerClientContext';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Network, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { useConfirmToast } from '../../features/shared/components/toasts/ConfirmToast';
import { NetworkService } from '../../features/docker-module/networks/services/NetworkService';
import NetworkCards from '../../features/docker-module/networks/components/cards/NetworkCards';
import CreateNetworkModal from '../../features/docker-module/networks/components/modals/CreateNetworkModal';

const NetworksPage: React.FC = () => {
  const confirmToast = useConfirmToast();
  const [loading, setLoading] = useState(false);
  const { dictionary } = useTranslation();
  const networkTexts = dictionary.docker.networks;
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkItem[]>([]);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const { connecting, dockerClientId, loading: credentialsLoading } = useDockerClient();

  const fetchNetworks = useCallback(async () => {
    if (!dockerClientId) return;

    try {
      setLoading(true);
      setError(null);

      const result = await NetworkService.findAllNetworks(dockerClientId);
      setNetworks(Array.isArray(result) ? result : []);
    } catch (fetchError) {
      console.error('Erro ao carregar redes Docker:', fetchError);
      toast.error(currentDictionary().docker.networks.loadFailed);
      setError(currentDictionary().docker.networks.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [dockerClientId]);

  useEffect(() => {
    if (!dockerClientId || credentialsLoading || connecting) return;
    fetchNetworks();
  }, [dockerClientId, credentialsLoading, connecting, fetchNetworks]);

  const handleDeleted = (networkId: string) => {
    setNetworks((previousNetworks) => previousNetworks.filter((network) => network.Id !== networkId));
  };

  const handlePruneNetworks = () => {
    if (!dockerClientId) return;
    confirmToast({
      id: 'prune-networks',
      title: networkTexts.pruneTitle,
      message: networkTexts.pruneMessage,
      onConfirm: async () => {
        await NetworkService.pruneAllNetworks(dockerClientId);
        toast.success(networkTexts.pruned);
        await fetchNetworks();
      },
    });
  };

  const filteredNetworks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return networks;

    return networks.filter((network) => {
      const name = (network.Name || '').toLowerCase();
      const driver = (network.Driver || '').toLowerCase();
      const id = (network.Id || '').toLowerCase();
      const subnet = (network.IPAM?.Config?.[0]?.Subnet || '').toLowerCase();
      return (
        name.includes(normalizedQuery) ||
        driver.includes(normalizedQuery) ||
        id.includes(normalizedQuery) ||
        subnet.includes(normalizedQuery)
      );
    });
  }, [networks, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200 dark:border-white/5">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {networkTexts.title}
          </h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {networkTexts.description}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePruneNetworks}
            disabled={!dockerClientId || connecting || loading}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-200 cursor-pointer"
            title={networkTexts.pruneHint}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{networkTexts.prune}</span>
          </button>

          <button
            type="button"
            onClick={fetchNetworks}
            disabled={!dockerClientId || connecting || loading}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl hover:border-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-200 cursor-pointer"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{dictionary.docker.common.refresh}</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenCreateModal(true)}
            disabled={!dockerClientId || connecting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{networkTexts.newNetwork}</span>
          </button>
        </div>
      </div>

      {credentialsLoading || connecting ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 p-10 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            {dictionary.docker.volumes.connectingClient}
          </p>
        </div>
      ) : !dockerClientId ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-10 text-center space-y-2">
          <Network className="w-8 h-8 text-gray-400 dark:text-zinc-500 mx-auto" />
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
            {dictionary.docker.common.noCredential}
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {networkTexts.selectCredentialHint}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={networkTexts.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] bg-white dark:bg-zinc-900/50 p-10 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                {networkTexts.loading}
              </span>
            </div>
          ) : filteredNetworks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40 p-10 text-center space-y-1.5">
              <Network className="w-7 h-7 text-gray-400 dark:text-zinc-500 mx-auto" />
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
                {networkTexts.empty}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {searchQuery
                  ? networkTexts.noMatch
                  : networkTexts.createHint}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredNetworks.map((network) => (
                <NetworkCards
                  key={network.Id}
                  clientId={dockerClientId}
                  onDeleted={handleDeleted}
                  {...network}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <CreateNetworkModal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        onCreated={fetchNetworks}
      />
    </div>
  );
};

export default NetworksPage;
