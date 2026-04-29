import React from 'react';
import ImageBuildForm from '../forms/ImageBuildForm';
import { Modal } from '../../../../../features/shared/components/modals/Modal';

interface ImageBuildModalProps {
    clientId: number;
    onClose: () => void;
    onSuccess?: () => void;
}

const ImageBuildModal: React.FC<ImageBuildModalProps> = ({ clientId, onClose, onSuccess }) => {

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Construir Nova Imagem"
            description="Criar imagem a partir de Dockerfile"
            icon={<span className="inline-block h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
            size="lg"
        >
            <ImageBuildForm
                clientId={clientId}
                onClose={onClose}
                onSuccess={onSuccess}
            />
        </Modal>
    );
};

export default ImageBuildModal;
