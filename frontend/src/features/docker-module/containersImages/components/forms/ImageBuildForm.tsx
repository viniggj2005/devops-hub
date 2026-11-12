import Convert from 'ansi-to-html';
import toast from 'react-hot-toast';
import RichMessage from '../../../../i18n/RichMessage';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Events } from '@wailsio/runtime';
import { FolderOpen, AlertTriangle } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { errorMessage } from '../../../../shared/functions/ErrorMessage';
import { GetFilePath } from '../../../../../../bindings/docker-manager-go/app';
import TextField from '../../../../../features/login/components/fields/TextField';
import { ImageCreate } from '../../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';

const converter = new Convert({
    newline: true,
    escapeXML: true,
});

interface ImageBuildFormProps {
    clientId: number;
    onClose: () => void;
    onSuccess?: () => void;
}
const ImageBuildForm: React.FC<ImageBuildFormProps> = ({ clientId, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const { dictionary } = useTranslation();
    const buildTexts = dictionary.docker.imageBuild;
    const [path, setPath] = useState('');
    const [tag, setTag] = useState('latest');
    const [builded, setBuilded] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [building, setBuilding] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleBrowseClick = async () => {
        try {
            const fullPath = await GetFilePath();
            if (fullPath) {
                setPath(fullPath);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleBuild = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim() || !tag.trim() || !path.trim()) {
            toast.error(buildTexts.fillAll);
            return;
        }

        const nameRegex = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
        if (!nameRegex.test(name)) {
            toast.error(buildTexts.invalidName);
            return;
        }

        let contextPath = path;
        let dockerfileName = 'Dockerfile';

        const lastSeparatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
        if (lastSeparatorIndex !== -1) {
            contextPath = path.substring(0, lastSeparatorIndex);
            dockerfileName = path.substring(lastSeparatorIndex + 1);
        }

        setBuilding(true);
        setLogs([]);

        const offBuildLogs = Events.On('image:build', ({ data }) => {
            if (data && data.log) {
                setLogs((previousLogs) => [...previousLogs, data.log]);
            }
        });

        try {
            await ImageCreate(clientId, {
                path: contextPath,
                name,
                tag,
                dockerfile: dockerfileName
            });
            toast.success(buildTexts.built);
            onSuccess?.();
            setBuilded(true);
        } catch (error) {
            setLogs((previousLogs) => [...previousLogs, `\nError: ${errorMessage(error)}`]);
            toast.error(errorMessage(error));
            onClose?.();
        } finally {
            offBuildLogs();
            setBuilding(false);
        }
    };

    return (
        <form onSubmit={handleBuild} className="grid gap-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                    <div className="text-sm text-red-800 dark:text-red-200">
                        <span className="font-semibold block mb-1">{buildTexts.attention}</span>
                        <RichMessage
                            template={buildTexts.dockerignoreHint}
                            values={{
                                dockerignore: <code className="bg-red-100 dark:bg-red-900/50 px-1 py-0.5 rounded text-xs">.dockerignore</code>,
                                nodeModules: <code className="bg-red-100 dark:bg-red-900/50 px-1 py-0.5 rounded text-xs">node_modules</code>,
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                    label={buildTexts.imageName}
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={buildTexts.namePlaceholder}
                    required
                    disabled={building || builded}
                />
                <TextField
                    label="Tag"
                    name="tag"
                    value={tag}
                    onChange={(event) => setTag(event.target.value)}
                    placeholder={buildTexts.tagPlaceholder}
                    required
                    disabled={building || builded}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-black dark:text-white">
                    {buildTexts.dockerfile}
                </label>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <TextField
                            label=""
                            name="path"
                            value={path}
                            onChange={(event) => setPath(event.target.value)}
                            placeholder={buildTexts.dockerfilePlaceholder}
                            required
                            disabled={building || builded}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleBrowseClick}
                        disabled={building || builded}
                        className="mt-1 flex items-center justify-center rounded-xl bg-gray-100 px-4 text-black hover:brightness-95 dark:bg-white/10 dark:text-white h-[42px]"
                        title={buildTexts.selectDockerfile}
                    >
                        <FolderOpen className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                    {buildTexts.logs}
                </label>
                <div className="h-64 w-full overflow-y-auto rounded-xl bg-gray-900 p-4 font-mono text-xs text-green-400 shadow-inner">
                    {logs.length === 0 ? (
                        <span className="text-gray-500 italic">{buildTexts.waiting}</span>
                    ) : (
                        logs.map((log, index) => {
                            const html = converter.toHtml(log);
                            return (
                                <div key={index} dangerouslySetInnerHTML={{ __html: html }} className="whitespace-pre-wrap font-mono" />
                            );
                        })
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
            {!builded && (
                <div className="mt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={building}
                        className="rounded-xl px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-white/10 disabled:opacity-50"
                    >
                        {dictionary.app.common.cancel}
                    </button>
                    <button
                        type="submit"
                        disabled={building}
                        className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {building ? buildTexts.building : buildTexts.build}
                    </button>
                </div>)}
        </form>
    );
};

export default ImageBuildForm;
