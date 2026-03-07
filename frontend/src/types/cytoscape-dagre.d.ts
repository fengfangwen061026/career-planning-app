declare module 'cytoscape-dagre' {
  import cytoscape from 'cytoscape';

  interface DagreLayoutOptions {
    name: 'dagre';
    rankDir?: 'TB' | 'BT' | 'LR' | 'RL';
    rankSep?: number;
    nodeSep?: number;
    edgeSep?: number;
    padding?: number;
    animate?: boolean;
    animationDuration?: number;
    animationEasing?: string;
    boundingBox?: undefined | { x1: number; y1: number; x2: number; y2: number };
    fit?: boolean;
    padding?: number | { top: number; bottom: number; left: number; right: number };
    nodeDimensionsIncludeLabels?: boolean;
    spacingFactor?: number;
    nodeSep?: number;
    rankSep?: number;
    edgeSep?: number;
  }

  function dagre(cytoscape: typeof cytoscape): void;
  export default dagre;
}
