import React from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import Select from '../../../../features/shared/components/forms/Select';
import { useDockerClient } from '../../../../contexts/DockerClientContext';
import { DockerCredentialSelectorProps } from '../../../../interfaces/DockerCredentialInterfaces';

const DockerCredentialSelector: React.FC<DockerCredentialSelectorProps> = ({
  variant = 'default',
}) => {
  const { isAuthenticated } = useAuth();
  const { ready, loading, connecting, credentials, selectedCredentialId, setSelectedCredentialId } =
    useDockerClient();

  if (!isAuthenticated) return null;

  const disabled = loading || connecting || credentials.length === 0;

  const containerClass =
    variant === 'navbar'
      ? 'flex items-center gap-2 text-xs'
      : [
        'w-full',

        'flex flex-col gap-3 md:flex-row md:items-start md:justify-between',
      ].join(' ');

  const wrapperClass =
    variant === 'navbar'
      ? 'flex items-center gap-2'
      : ['flex w-full flex-col gap-2', 'max-w-full'].join(' ');

  const labelClass =
    variant === 'navbar'
      ? 'sr-only'
      : 'text-xs uppercase font-semibold tracking-wider dark:text-gray-300';

  const labelId = 'docker-credential-selector-label';

  const placeholder =
    credentials.length === 0 ? (ready ? 'Cadastre uma credencial' : 'Carregando…') : 'Selecione…';

  return (
    <section className={containerClass}>
      <div className={wrapperClass}>
        <span id={labelId} className={labelClass}>
          Credencial Docker
        </span>

        <div className={['w-full max-w-full', 'overflow-visible'].join(' ')}>
          <Select
            id="docker-credential-selector"
            value={selectedCredentialId != null ? String(selectedCredentialId) : ''}
            disabled={disabled}
            variant={variant}
            options={credentials.map((credential) => ({
              value: String(credential.id),
              label: credential.alias,
            }))}
            placeholder={placeholder}
            aria-labelledby={variant === 'navbar' ? undefined : labelId}
            aria-label={variant === 'navbar' ? 'Credencial Docker' : undefined}
            onChange={(optionValue) =>
              setSelectedCredentialId(optionValue ? Number(optionValue) : null)
            }
          />
        </div>
      </div>
    </section>
  );
};

export default DockerCredentialSelector;
