import { useCallback, useEffect, useState } from "react";

interface ReloadOptions {
  silent?: boolean;
}

interface AsyncDataState<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  reload: (options?: ReloadOptions) => Promise<void>;
}

interface UseAsyncDataOptions {
  enabled?: boolean;
}

export function useAsyncData<T>(loader: () => Promise<T>, initialData: T, options: UseAsyncDataOptions = {}): AsyncDataState<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (reloadOptions: ReloadOptions = {}) => {
      if (!enabled) {
        setIsLoading(false);
        setError(null);
        return;
      }

      if (!reloadOptions.silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const value = await loader();
        setData(value);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao carregar dados";
        setError(message);
      } finally {
        if (!reloadOptions.silent) {
          setIsLoading(false);
        }
      }
    },
    [enabled, loader],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}
