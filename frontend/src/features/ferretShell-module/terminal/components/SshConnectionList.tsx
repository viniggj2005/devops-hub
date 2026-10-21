import toast from 'react-hot-toast';
import { Server, Plus } from 'lucide-react';
import { useTerminalStore } from '../TerminalStore';
import SshConnectionCard from './SshConnectionCard';
import { useAuth } from '../../../../contexts/AuthContext';
import EditSshConnectionModal from './EditSshConnectionModal';
import { SshDto } from '../../../../interfaces/TerminalInterfaces';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TerminalServices, toSshConn } from '../services/TerminalServices';
import { useConfirmToast } from '../../../shared/components/toasts/ConfirmToast';

interface SshConnectionListProps {
  token: string;
  search?: string;
  onCreateClick?: () => void;
}

const SshConnectionList: React.FC<SshConnectionListProps> = ({
  token,
  search = '',
  onCreateClick,
}) => {
  const { user } = useAuth();
  const confirmToast = useConfirmToast();
  const { createTab } = useTerminalStore();
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [connectionsList, setConnectionsList] = useState<SshDto[]>([]);
  const [editingConnection, setEditingConnection] = useState<SshDto | null>(null);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const list = await TerminalServices.findAllByUser(user ? user.id : 1, token);
      setConnectionsList(list);
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = useCallback(
    (id: number, alias: string) => {
      confirmToast({
        id: String(id),
        title: `Deletar conexão ${alias}?`,
        message: `Deseja deletar a conexão: ${alias}?`,
        onConfirm: async () => {
          await TerminalServices.deleteConnection(token, id);
          await loadConnections();
        },
      });
    },
    [token, confirmToast]
  );

  const handleEdit = (connection: SshDto) => {
    setEditingConnection(connection);
    setEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setEditingConnection(null);
  };

  const handleConnect = async (id: number) => {
    try {
      const connection = await TerminalServices.getById(token, id);
      const ssh = toSshConn(connection);
      const hasKey = !!(
        connection.key &&
        (Array.isArray(connection.key) ? connection.key.length : connection.key.toString().length)
      );
      const hasPassword = !!connection.password;
      if (hasKey || hasPassword) {
        createTab({ title: connection.alias || `${ssh.User}@${ssh.Host}`, config: ssh });
      } else {
        toast.error('Nenhum método de autenticação encontrado para esta conexão.');
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  useEffect(() => {
    loadConnections();
  }, [token]);

  const filteredConnections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return connectionsList;
    return connectionsList.filter(
      (connection) =>
        (connection.alias ?? '').toLowerCase().includes(normalizedSearch) ||
        connection.host.toLowerCase().includes(normalizedSearch) ||
        connection.systemUser.toLowerCase().includes(normalizedSearch) ||
        String(connection.port || 22).includes(normalizedSearch)
    );
  }, [connectionsList, search]);

  if (loading) {
    return (
      <p className="py-6 text-sm text-gray-500 dark:text-zinc-400">
        Carregando servidores SSH...
      </p>
    );
  }

  if (connectionsList.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-10 rounded-2xl border border-dashed border-gray-300 dark:border-white/10">
        <Server className="w-9 h-9 text-gray-300 dark:text-zinc-600" />
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Nenhum servidor SSH cadastrado ainda.
        </p>
        {onCreateClick && (
          <button
            onClick={onCreateClick}
            className="mt-1 px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Cadastrar primeiro servidor
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {filteredConnections.length === 0 ? (
        <p className="py-8 text-center text-xs text-gray-400">
          Nenhum servidor corresponde à busca.
        </p>
      ) : (
        <div>
          {filteredConnections.map((connection) => (
            <SshConnectionCard
              key={connection.id}
              connection={connection}
              handleEdit={handleEdit}
              handleRemove={handleRemove}
              handleConnect={handleConnect}
            />
          ))}
        </div>
      )}
      {editingConnection && (
        <EditSshConnectionModal
          open={editModalOpen}
          onClose={handleCloseEdit}
          onCreated={loadConnections}
          connection={editingConnection}
        />
      )}
    </>
  );
};

export default SshConnectionList;
