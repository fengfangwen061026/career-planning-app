import { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { graphApi } from '../api/graph';
import type { AdaptedGraphData, RawGraphResponse } from '../types/graph';
import { adaptGraphResponse } from '../utils/graphAdapter';

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '图谱数据请求失败，请稍后重试。';
}

export function useGraphData() {
  const [rawData, setRawData] = useState<RawGraphResponse | null>(null);
  const [adaptedData, setAdaptedData] = useState<AdaptedGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraphData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [cytoscapeResponse, nodesResponse, edgesResponse] = await Promise.all([
        graphApi.getCytoscape(),
        graphApi.getNodes({ limit: 1000 }),
        graphApi.getEdges({ limit: 1000 }),
      ]);

      const nodeDetails = new Map(nodesResponse.data.map((node) => [node.id, node] as const));
      const edgeDetails = new Map(edgesResponse.data.map((edge) => [edge.id, edge] as const));
      const mergeNodeDetails = (elementData: Record<string, unknown>) => {
        const elementId = String(elementData.id ?? '');

        if (nodeDetails.has(elementId)) {
          return { ...elementData, ...nodeDetails.get(elementId) };
        }

        for (const [key, node] of nodeDetails.entries()) {
          if (key.includes(elementId) || elementId.includes(key)) {
            console.warn('[useGraphData] Node detail matched by fuzzy id:', { elementId, matchedId: key });
            return { ...elementData, ...node };
          }
        }

        console.warn('[useGraphData] Node detail not found:', elementId);
        return elementData;
      };
      const nextRawData: RawGraphResponse = {
        elements: cytoscapeResponse.data.elements.map((element) => {
          const data = element.data ?? {};

          if (data.id && !data.source && !data.target) {
            return {
              data: mergeNodeDetails(data),
            };
          }

          if (data.id) {
            const edgeId = String(data.id);
            if (!edgeDetails.has(edgeId)) {
              console.warn('[useGraphData] Edge detail not found:', edgeId);
            }
            return {
              data: {
                ...data,
                ...edgeDetails.get(edgeId),
              },
            };
          }

          return element;
        }),
      };
      setRawData(nextRawData);
      setAdaptedData(adaptGraphResponse(nextRawData));
      setError(null);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
      setRawData(null);
      setAdaptedData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchGraphData(true);
  }, [fetchGraphData]);

  return {
    rawData,
    adaptedData,
    loading,
    refreshing,
    error,
    refetch: () => fetchGraphData(false),
  };
}
