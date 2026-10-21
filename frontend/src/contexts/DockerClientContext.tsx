import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { DockerCredentialService } from '../features/docker-module/dockerCredentials/services/DockerCredentialService';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DockerClientContextValue, DockerCredentialSummary } from '../interfaces/DockerCredentialInterfaces';

const DockerClientContext = createContext<DockerClientContextValue | undefined>(undefined);

export const DockerClientProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const { token, user, isAuthenticated } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const lastConnectedIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dockerClientId, setDockerClientId] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<DockerCredentialSummary[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !user?.id) {
      setCredentials([]);
      setSelectedCredentialId(null);
      setReady(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const credentialList = await DockerCredentialService.list(token, user.id);
      setCredentials(credentialList);

      setSelectedCredentialId((current) => {
        if (current && credentialList.some((item) => item.id === current)) {
          return current;
        }
        return credentialList.length > 0 ? credentialList[0].id : null;
      });
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
      setError(message);
      toast.error(message);
      setCredentials([]);
      setSelectedCredentialId(null);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [token, user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setCredentials([]);
      setSelectedCredentialId(null);
      setDockerClientId(null);
      lastConnectedIdRef.current = null;
      setReady(false);
    }
  }, [isAuthenticated, refresh]);

  useEffect(() => {
    if (selectedCredentialId == null) {
      lastConnectedIdRef.current = null;
      setDockerClientId(null);
      setConnecting(false);
      return;
    }

    if (lastConnectedIdRef.current === selectedCredentialId) {
      if (dockerClientId !== selectedCredentialId) {
        setDockerClientId(selectedCredentialId);
      }
      return;
    }

    let cancelled = false;
    setConnecting(true);
    setError(null);

    DockerCredentialService.connect(selectedCredentialId)
      .then(() => {
        if (cancelled) return;
        lastConnectedIdRef.current = selectedCredentialId;
        setDockerClientId(selectedCredentialId);
      })
      .catch((connectError) => {
        if (cancelled) return;
        const message = connectError instanceof Error ? connectError.message : String(connectError);
        setError(message);
        toast.error(message);
        setDockerClientId(null);
        lastConnectedIdRef.current = null;
      })
      .finally(() => {
        if (!cancelled) {
          setConnecting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCredentialId, dockerClientId]);

  const value = useMemo(
    () => ({
      error,
      ready,
      loading,
      refresh,
      connecting,
      credentials,
      dockerClientId,
      selectedCredentialId,
      setSelectedCredentialId,
    }),
    [credentials, connecting, dockerClientId, error, loading, ready, refresh, selectedCredentialId]
  );

  return <DockerClientContext.Provider value={value}>{children}</DockerClientContext.Provider>;
};

export const useDockerClient = () => {
  const context = useContext(DockerClientContext);
  if (!context) {
    throw new Error('useDockerClient deve ser usado dentro de DockerClientProvider');
  }
  return context;
};
