import { useState, useCallback } from "react";
import { ApiError } from "@/api/client";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) {
  const [state, setState] = useState<State<TResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: TArgs) => {
      setState({ data: null, loading: true, error: null });
      try {
        const data = await fn(...args);
        setState({ data, loading: false, error: null });
        return data;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? `${err.status}: ${err.message}`
            : String(err);
        setState({ data: null, loading: false, error: msg });
        return null;
      }
    },
    [fn]
  );

  return { ...state, execute };
}
