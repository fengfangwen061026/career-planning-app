import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core, type EventObjectNode } from 'cytoscape';
import type { ElementDefinition } from 'cytoscape';
import type { GraphLayoutType } from '../../types/graph';

type TooltipState = {
  label: string;
  x: number;
  y: number;
} | null;

interface CytoscapeGraphProps {
  elements: ElementDefinition[];
  nodeCount: number;
  selectedNodeId?: string;
  selectedEdgeId?: string;
  layout: GraphLayoutType;
  onNodeSelect: (nodeId: string) => void;
  onEdgeSelect: (edgeId: string) => void;
  onCanvasClick: () => void;
}

function createStylesheet(): Array<{ selector: string; style: Record<string, unknown> }> {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': -10,
        'font-size': 'data(labelSize)',
        color: '#334155',
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.92,
        'text-background-padding': 3,
        'text-background-shape': 'round-rectangle',
        'min-zoomed-font-size': 8,
        'background-color': 'data(color)',
        width: 'data(size)',
        height: 'data(size)',
        'border-width': 2,
        'border-color': '#ffffff',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#2563eb',
        'overlay-color': '#60a5fa',
        'overlay-opacity': 0.12,
      },
    },
    {
      selector: 'edge',
      style: {
        width: 2,
        label: 'data(edgeLabel)',
        'font-size': 10,
        color: '#475569',
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.9,
        'text-background-padding': 2,
        'text-rotation': 'autorotate',
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1,
        opacity: 0.88,
      },
    },
    {
      selector: 'edge[edgeType = "vertical"]',
      style: {
        'line-color': '#2563eb',
        'target-arrow-color': '#2563eb',
        'line-style': 'solid',
      },
    },
    {
      selector: 'edge[edgeType = "transition"]',
      style: {
        'line-color': '#16a34a',
        'target-arrow-color': '#16a34a',
        'line-style': 'dashed',
        'line-dash-pattern': [8, 4],
      },
    },
    {
      selector: 'edge[edgeType = "related"]',
      style: {
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        'line-style': 'solid',
      },
    },
    {
      selector: 'edge:selected',
      style: {
        width: 4,
        'line-color': '#f97316',
        'target-arrow-color': '#f97316',
      },
    },
  ];
}

function getLayoutConfig(layout: GraphLayoutType, nodeCount: number) {
  const shouldAnimate = nodeCount < 30;

  if (layout === 'circle') {
    return {
      name: 'circle',
      animate: shouldAnimate,
      padding: 30,
    } as const;
  }

  if (layout === 'grid') {
    return {
      name: 'grid',
      animate: false,
      padding: 30,
      avoidOverlap: true,
    } as const;
  }

  return {
    name: 'cose',
    animate: shouldAnimate,
    animationDuration: shouldAnimate ? 350 : 0,
    fit: true,
    padding: 40,
    nodeRepulsion: nodeCount < 30 ? 9000 : 5000,
    idealEdgeLength: nodeCount < 30 ? 120 : 90,
    gravity: 0.25,
    numIter: nodeCount < 30 ? 800 : 400,
  } as const;
}

export function CytoscapeGraph({
  elements,
  nodeCount,
  selectedNodeId,
  selectedEdgeId,
  layout,
  onNodeSelect,
  onEdgeSelect,
  onCanvasClick,
}: CytoscapeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const isInitialMountRef = useRef(true);
  const movedNodeIdsRef = useRef<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const stylesheet = useMemo(() => createStylesheet(), []);

  const runLayout = (cy: Core) => {
    const movedNodes = Array.from(movedNodeIdsRef.current)
      .map((nodeId) => cy.getElementById(nodeId))
      .filter((node) => node.nonempty());

    movedNodes.forEach((node) => node.lock());

    const layoutInstance = cy.layout(getLayoutConfig(layout, nodeCount));
    layoutInstance.run();
    layoutInstance.on('layoutstop', () => {
      movedNodes.forEach((node) => node.unlock());
    });
  };

  useEffect(() => {
    if (!containerRef.current || cyRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: stylesheet as never,
      minZoom: 0.25,
      maxZoom: 2.2,
      wheelSensitivity: 0.22,
    });

    cy.on('tap', 'node', (event) => {
      onNodeSelect(String(event.target.id()));
    });

    cy.on('tap', 'edge', (event) => {
      onEdgeSelect(String(event.target.id()));
    });

    cy.on('tap', (event) => {
      if (event.target === cy) {
        onCanvasClick();
      }
    });

    cy.on('mouseover', 'node', (event: EventObjectNode) => {
      const rendered = event.target.renderedPosition();
      setTooltip({
        label: String(event.target.data('fullLabel') ?? event.target.data('label') ?? ''),
        x: rendered.x,
        y: rendered.y,
      });
    });

    cy.on('mouseout', 'node', () => {
      setTooltip(null);
    });

    cy.on('dragfree', 'node', (event) => {
      movedNodeIdsRef.current.add(String(event.target.id()));
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [onCanvasClick, onEdgeSelect, onNodeSelect, stylesheet]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !elements.length) {
      return;
    }

    const previousPositions = new Map(
      cy.nodes().map((node) => [node.id(), node.position()] as const),
    );
    const selectedNodeIds = cy.$('node:selected').map((node) => node.id());
    const selectedEdgeIds = cy.$('edge:selected').map((edge) => edge.id());

    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);

      for (const [nodeId, position] of previousPositions.entries()) {
        const node = cy.getElementById(nodeId);
        if (node.nonempty()) {
          node.position(position);
        }
      }
    });

    for (const nodeId of selectedNodeIds) {
      const node = cy.getElementById(nodeId);
      if (node.nonempty()) {
        node.select();
      }
    }

    for (const edgeId of selectedEdgeIds) {
      const edge = cy.getElementById(edgeId);
      if (edge.nonempty()) {
        edge.select();
      }
    }

    runLayout(cy);
    if (isInitialMountRef.current) {
      cy.fit(undefined, 40);
      isInitialMountRef.current = false;
    }
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !elements.length) {
      return;
    }

    runLayout(cy);
  }, [layout, nodeCount]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.elements().unselect();

    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId);
      if (node.nonempty()) {
        node.select();
      }
      return;
    }

    if (selectedEdgeId) {
      const edge = cy.getElementById(selectedEdgeId);
      if (edge.nonempty()) {
        edge.select();
      }
    }
  }, [selectedEdgeId, selectedNodeId]);

  return (
    <div className="relative h-full min-h-[65vh] overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0)]">
      <div ref={containerRef} className="h-full min-h-[65vh] w-full" />

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-white/85 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur">
        <div>拖拽节点可微调布局</div>
        <div>滚轮缩放，单击空白区域清空选中</div>
      </div>

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 max-w-64 -translate-x-1/2 rounded-lg bg-slate-950 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: tooltip.x, top: Math.max(12, tooltip.y - 42) }}
        >
          {tooltip.label}
        </div>
      ) : null}
    </div>
  );
}
