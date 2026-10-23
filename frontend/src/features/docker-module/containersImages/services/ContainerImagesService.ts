import toast from 'react-hot-toast';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DockerImageInfo } from '../../../../interfaces/ContainerImagesInterfaces';
import { ImagesList } from '../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';

export const ContainerImagesService = (clientId: number | null, pollMiliseconds = 4000) => {
  const timerRef = useRef<number | null>(null);
  const hasLoadedRef = useRef<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<DockerImageInfo[]>([]);

  const fetchImages = useCallback(async (showSpinner = false) => {
    if (clientId == null) {
      setLoading(false);
      setImages([]);
      hasLoadedRef.current = false;
      return;
    }
    try {
      if (showSpinner || !hasLoadedRef.current) {
        setLoading(true);
      }
      const imagesList = await ImagesList(clientId);
      setImages((imagesList as DockerImageInfo[]) ?? []);
      hasLoadedRef.current = true;
    } catch (error: any) {
      toast.error(String(error?.message ?? error));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    hasLoadedRef.current = false;
    if (clientId == null) {
      setLoading(false);
      setImages([]);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    fetchImages(true);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => fetchImages(false), pollMiliseconds);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [clientId, fetchImages, pollMiliseconds]);

  return { images, loading, fetchImages, setImages };
};
