import { useState, useEffect, useCallback } from "react";
import { graphApi } from "../../api/graph";
import type { GraphTotals, JobGraphData, GraphNode } from "./types";

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
      const nodes = response.data.nodes as GraphNode[];
      const graphData: JobGraphData = {
        nodes,
        edges: response.data.edges,
        totals: response.data.totals ?? deriveTotals(nodes),
        generated_at: response.data.generated_at,
      };
      setData(graphData);
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
      await graphApi.rebuildMindmap();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rebuild graph");
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, rebuild };
}

function deriveTotals(nodes: GraphNode[]): GraphTotals {
  const categoryNodes = nodes.filter((node) => node.type === "category");
  const jobNodes = nodes.filter((node) => node.type === "job");

  const categoryJdTotal = categoryNodes.reduce((sum, node) => {
    return sum + (typeof node.jd_total === "number" ? node.jd_total : 0);
  }, 0);

  if (categoryJdTotal > 0) {
    return {
      role_count: jobNodes.length,
      jd_count: categoryJdTotal,
      category_count: categoryNodes.length,
    };
  }

  const jobJdTotal = jobNodes.reduce((sum, node) => {
    return sum + (typeof node.jd_count === "number" ? node.jd_count : 0);
  }, 0);

  return {
    role_count: jobNodes.length,
    jd_count: jobJdTotal,
    category_count: categoryNodes.length,
  };
}
