import { useEffect, useState } from 'react';
import { GetAppVersion } from '../../../../bindings/docker-manager-go/app';

const DEFAULT_APP_VERSION = '1.0.0';
let cachedVersion: string | null = null;
let pendingVersionPromise: Promise<string> | null = null;

function fetchAppVersion(): Promise<string> {
  if (cachedVersion) {
    return Promise.resolve(cachedVersion);
  }
  if (!pendingVersionPromise) {
    pendingVersionPromise = GetAppVersion()
      .then((versionString) => {
        const trimmedVersion = versionString?.trim() || DEFAULT_APP_VERSION;
        cachedVersion = trimmedVersion;
        return trimmedVersion;
      })
      .catch(() => {
        cachedVersion = DEFAULT_APP_VERSION;
        return DEFAULT_APP_VERSION;
      })
      .finally(() => {
        pendingVersionPromise = null;
      });
  }
  return pendingVersionPromise;
}

export function useAppVersion(): string {
  const [appVersion, setAppVersion] = useState<string>(cachedVersion ?? DEFAULT_APP_VERSION);

  useEffect(() => {
    let cancelled = false;
    fetchAppVersion().then((resolvedVersion) => {
      if (!cancelled) {
        setAppVersion(resolvedVersion);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return appVersion;
}

