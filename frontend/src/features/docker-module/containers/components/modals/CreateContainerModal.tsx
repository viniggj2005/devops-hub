import { Box } from 'lucide-react';
import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import { PortsSection } from '../create-modal/PortsSection';
import { errorMessage } from '../../../../shared/functions/ErrorMessage';
import { EnvVarsSection } from '../create-modal/EnvVarsSection';
import { VolumesSection } from '../create-modal/VolumesSection';
import { BasicInfoSection } from '../create-modal/BasicInfoSection';
import { Modal } from '../../../../../features/shared/components/modals/Modal';
import { ResourceLimitsSection } from '../create-modal/ResourceLimitsSection';
import { useDockerClient } from '../../../../../contexts/DockerClientContext';
import * as dockerDtos from '../../../../../../bindings/docker-manager-go/src/dockermanager/dtos/models';
import * as image from '../../../../../../bindings/github.com/docker/docker/api/types/image/models';
import { CreateContainer, ImagesList, ListVolumes, ListNetworks } from '../../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';
import { CreateContainerPortMapping, CreateContainerEnvVar, CreateContainerVolumeMapping } from '../../../../../interfaces/ContainerInterfaces';

interface CreateContainerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateContainerModal: React.FC<CreateContainerModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { dockerClientId } = useDockerClient();
    const [loading, setLoading] = useState(false);

    const [availableVolumes, setAvailableVolumes] = useState<any[]>([]);
    const [availableNetworks, setAvailableNetworks] = useState<any[]>([]);
    const [availableImages, setAvailableImages] = useState<image.Summary[]>([]);

    const [imageName, setImageName] = useState('');
    const [containerName, setContainerName] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState('bridge');
    const [envVars, setEnvVars] = useState<CreateContainerEnvVar[]>([]);
    const [ports, setPorts] = useState<CreateContainerPortMapping[]>([]);
    const [volumes, setVolumes] = useState<CreateContainerVolumeMapping[]>([]);

    const [memory, setMemory] = useState('');
    const [cpu, setCpu] = useState('');
    const [pidsLimit, setPidsLimit] = useState('');

    useEffect(() => {
        if (isOpen && dockerClientId) {
            ImagesList(dockerClientId).then((imagesResponse: any) => {
                setAvailableImages(imagesResponse || []);
            }).catch(() => {
                toast.error('Falha ao carregar imagens.');
            });

            ListVolumes(dockerClientId).then((volumesJson: any) => {
                try {
                    const data = JSON.parse(volumesJson);
                    setAvailableVolumes(data.Volumes || []);
                } catch {
                    toast.error('Falha ao processar lista de volumes.');
                }
            }).catch(() => {
                toast.error('Falha ao carregar volumes.');
            });

            ListNetworks(dockerClientId).then((networksJson: any) => {
                try {
                    const data = JSON.parse(networksJson);
                    setAvailableNetworks(Array.isArray(data) ? data : []);
                } catch {
                    toast.error('Falha ao processar lista de redes.');
                }
            }).catch(() => {
                toast.error('Falha ao carregar redes.');
            });
        }
    }, [isOpen, dockerClientId]);

    const handleSubmit = async () => {
        if (!dockerClientId) return;
        if (!imageName) {
            toast.error('O nome da imagem é obrigatório');
            return;
        }

        setLoading(true);
        try {
            const exposedPorts: Record<string, any> = {};
            const portBindings: Record<string, any[]> = {};

            ports.forEach(portMapping => {
                if (portMapping.containerPort) {
                    const portKey = `${portMapping.containerPort}/tcp`;
                    exposedPorts[portKey] = {};
                    if (portMapping.hostPort) {
                        portBindings[portKey] = [{ HostPort: portMapping.hostPort }];
                    }
                }
            });

            const envList = envVars
                .filter(envItem => envItem.key)
                .map(envItem => `${envItem.key}=${envItem.value}`);

            const binds = volumes
                .filter(volumeItem => volumeItem.hostPath && volumeItem.containerPath)
                .map(volumeItem => `${volumeItem.hostPath}:${volumeItem.containerPath}`);

            const options = new dockerDtos.ContainerCreateOptions({
                containerName: containerName,
                config: {
                    Image: imageName,
                    ExposedPorts: exposedPorts,
                    Env: envList,
                },
                hostConfig: {
                    PortBindings: portBindings,
                    Binds: binds,
                    Memory: memory ? parseInt(memory) * 1024 * 1024 : 0,
                    NanoCpus: cpu ? parseFloat(cpu) * 1000000000 : 0,
                    PidsLimit: pidsLimit ? parseInt(pidsLimit) : 0,
                },
                networkingConfig: {
                    EndpointsConfig: {
                        [selectedNetwork]: {}
                    }
                },
                platform: null
            });

            await CreateContainer(dockerClientId, options);

            toast.success('Container criado com sucesso');
            onSuccess();
            onClose();

            setContainerName('');
            setImageName('');
            setPorts([]);
            setEnvVars([]);
            setVolumes([]);
            setMemory('');
            setCpu('');
            setPidsLimit('');
        } catch (error) {
            console.error(error);
            toast.error(`Falha ao criar container: ${errorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Criar Novo Container"
            icon={<Box className="w-5 h-5 text-blue-500" />}
            className="max-w-3xl"
        >
            <div className="space-y-6">
                <BasicInfoSection
                    containerName={containerName}
                    setContainerName={setContainerName}
                    imageName={imageName}
                    setImageName={setImageName}
                    selectedNetwork={selectedNetwork}
                    setSelectedNetwork={setSelectedNetwork}
                    availableImages={availableImages}
                    availableNetworks={availableNetworks}
                />

                <PortsSection ports={ports} setPorts={setPorts} />

                <EnvVarsSection envVars={envVars} setEnvVars={setEnvVars} />

                <VolumesSection volumes={volumes} setVolumes={setVolumes} availableVolumes={availableVolumes} />

                <ResourceLimitsSection
                    memory={memory}
                    setMemory={setMemory}
                    cpu={cpu}
                    setCpu={setCpu}
                    pidsLimit={pidsLimit}
                    setPidsLimit={setPidsLimit}
                />
            </div>

            <div className="mt-8 flex justify-end gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    {loading ? 'Criando...' : 'Criar Container'}
                </button>
            </div>
        </Modal>
    );
};
