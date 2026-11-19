import toast from 'react-hot-toast';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTabVisible } from '../../../appFrame/TabVisibility';
import { errorMessage } from '../../../shared/functions/ErrorMessage';
import { DockerImageInfo } from '../../../../interfaces/ContainerImagesInterfaces';
import { ImagesList } from '../../../../../bindings/docker-manager-go/src/dockermanager/handlers/dockersdkhandlerstruct';

export const ContainerImagesService = (clientId: number | null, pollMiliseconds = 4000) => {
  const tabVisible = useTabVisible();
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
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    hasLoadedRef.current = false;
    if (clientId == null) {
      setLoading(false);
      setImages([]);
      return;
    }
    fetchImages(true);
  }, [clientId, fetchImages]);

  useEffect(() => {
    if (clientId == null || !tabVisible) return;
    if (hasLoadedRef.current) fetchImages(false);
    const timerId = window.setInterval(() => fetchImages(false), pollMiliseconds);
    return () => window.clearInterval(timerId);
  }, [clientId, tabVisible, fetchImages, pollMiliseconds]);

  return { images, loading, fetchImages, setImages };
};
