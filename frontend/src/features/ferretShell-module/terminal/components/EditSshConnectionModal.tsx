import React, { useMemo } from 'react';
import { FilePen } from 'lucide-react';
import { toBase64 } from '../functions/TreatmentFunctions';
import EditSshConnectionForm from './EditSshConnectionForm';
import { Modal } from '../../../shared/components/modals/Modal';
import { EditSshConnectionModalProps, CreateSshConnectionInterface } from '../../../../interfaces/TerminalInterfaces';

const EditSshConnectionModal: React.FC<EditSshConnectionModalProps> = ({
  open,
  onClose,
  onCreated,
  connection,
}) => {

  const normalized: CreateSshConnectionInterface | null = useMemo(() => {
    if (!connection) return null;
    return {
      userId: undefined,
      host: connection.host,
      key: toBase64(connection.key),
      systemUser: connection.systemUser,
      port: connection.port ?? undefined,
      alias: connection.alias ?? undefined,
      password: connection.password ? connection.password : undefined,
      knownHosts: connection.knownHostsData ?? undefined,
    };
  }, [connection]);

  if (!open || !normalized) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Editar conexão SSH"
      description="modifique os dados necessários"
      icon={<FilePen className="w-5 h-5 text-blue-500" />}
    >
      <div className="pb-2">
        <EditSshConnectionForm
          connection={normalized}
          id={connection!.id}
          onSuccess={() => {
            onClose();
            onCreated?.();
          }}
        />
      </div>
    </Modal>
  );
};

export default EditSshConnectionModal;
