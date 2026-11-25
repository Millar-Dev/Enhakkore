'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from './api';

/** GET a control-centre endpoint, with reload and a readable error. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api.get<T>(path));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load.');
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload, setData };
}

/** Reads a query parameter on the client without a Suspense boundary. */
export function useQueryParam(name: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => setValue(new URLSearchParams(window.location.search).get(name)), [name]);
  return value;
}
