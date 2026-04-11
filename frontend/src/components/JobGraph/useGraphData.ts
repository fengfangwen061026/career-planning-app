import { useState, useEffect, useCallback } from "react";
import { graphApi } from "../../api/graph";
import type { JobGraphData } from "./types";

interface UseGraphDataResult {
  data: JobGraphData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  rebuild: () => Promise<void>;
}

export function useGraphData(): UseGraphDataResult {
  const [data, setData] = useState<JobGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await graphApi.getMindmap();
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取图谱数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const rebuild = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await graphApi.rebuildMindmap();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "重建图谱失败");
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, rebuild };
}
