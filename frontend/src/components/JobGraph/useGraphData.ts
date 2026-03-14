import { useState, useEffect, useCallback } from "react";
import apiClient from "../../api/client";
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
      const response = await apiClient.get<JobGraphData>("/jobs/graph");
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch graph data");
    } finally {
      setLoading(false);
    }
  }, []);

  const rebuild = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/jobs/graph/rebuild", {});
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rebuild graph");
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, rebuild };
}
