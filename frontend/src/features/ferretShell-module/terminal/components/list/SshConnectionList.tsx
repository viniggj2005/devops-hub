import iziToast from 'izitoast';
import { useTerminalStore } from '../../TerminalStore';
import SshConnectionCard from "../cards/SshConnectionCard";
import { useAuth } from '../../../../../contexts/AuthContext';
import React, { useCallback, useEffect, useState } from 'react';
import { SshDto } from '../../../../../interfaces/TerminalInterfaces';
import EditSshConnectionModal from '../modals/EditSshConnectionModal';
import { TerminalServices, toSshConn } from '../../services/TerminalServices';
import { useConfirmToast } from '../../../../shared/components/toasts/ConfirmToast';

const SshConnectionList: React.FC<{ token: string }> = ({ token }) => {
  const { user } = useAuth();
  const confirmToast = useConfirmToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openWith, requirePassword } = useTerminalStore();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [connectionsList, setConnectionsList] = useState<SshDto[]>([]);
  const [editingConnection, setEditingConnection] = useState<SshDto | null>(null);

  const loadConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await TerminalServices.findAllByUser(user ? user.id : 1, token);
      setConnectionsList(list);
    } catch (error: any) {
      setError(error?.message ?? 'Erro ao buscar conexões');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = useCallback(
    (id: number, alias: string) => {
      confirmToast({
        id: String(id),
        title: `Conexão ${alias} deletada!`,
        message: `Deseja deletar a conexão: ${alias}?`,
        onConfirm: async () => {
          await TerminalServices.deleteConnection(token, id);
          await loadConnections();
        },
      });
    },
    [token]
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
      const hasKey = !!(connection.key && connection.key.length);
      hasKey ? openWith(ssh) : requirePassword(ssh);
    } catch (error) {
      setError('Falha ao abrir terminal');
    }
  };

  useEffect(() => {
    loadConnections();
  }, [token]);

  useEffect(() => {
    if (loading) {
      iziToast.info({ title: 'Carregando', message: 'Carregando conexões...', position: 'bottomRight' });
    } else if (error) {
      iziToast.error({ title: 'Erro', message: error, position: 'bottomRight' });
    } else if (!connectionsList.length) {
      iziToast.info({ title: 'Vazio', message: 'Nenhuma conexão listada.', position: 'bottomRight' });
    }
  }, [loading, error, connectionsList.length]);

  return (
    <>
      <div className="divide-y divide-gray-300 dark:divide-white/10">
        {connectionsList.map((connection) => {
          return (
            <SshConnectionCard
              key={connection.id}
              connection={connection}
              handleConnect={handleConnect}
              handleEdit={handleEdit}
              handleRemove={handleRemove}
            />
          );
        })}
      </div>
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
