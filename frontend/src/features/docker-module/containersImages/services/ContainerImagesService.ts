import iziToast from 'izitoast';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DockerImageInfo } from '../../../../interfaces/ContainerImagesInterfaces';
import { ImagesList } from '../../../../../wailsjs/go/dockerHandlers/DockerSdkHandlerStruct';

export const ContainerImagesService = (clientId: number | null, pollMiliseconds = 2000) => {
  const timerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<DockerImageInfo[]>([]);

  const fetchImages = useCallback(async () => {
    if (clientId == null) {
      setLoading(false);
      setImages([]);
      return;
    }
    try {
      setLoading(true);
      const imagesList = await ImagesList(clientId);
      setImages((imagesList as DockerImageInfo[]) ?? []);
    } catch (error: any) {
      iziToast.error({
        title: 'Erro',
        message: String(error?.message ?? error),
        position: 'bottomRight',
      });
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId == null) {
      setLoading(false);
      setImages([]);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    fetchImages();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(fetchImages, pollMiliseconds);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [clientId, fetchImages, pollMiliseconds]);

  return { images, loading, fetchImages, setImages };
};
