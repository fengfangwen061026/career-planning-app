export const graphStyles = {
  fontFamily:
    '"IBM Plex Sans", "PingFang SC", "Segoe UI", sans-serif',
  pageBackground:
    "radial-gradient(circle at top, #F8FBFF 0%, #F2F6FF 44%, #FFF7F1 100%)",

  gray900: "#172033",
  gray700: "#43506A",
  gray500: "#73809A",
  gray300: "#D2DAE6",

  nodeWidths: {
    small: 168,
    medium: 186,
    large: 206,
  },
  nodeHeights: {
    small: 78,
    medium: 84,
    large: 92,
  },
  nodeRadius: 20,
  nodeAccentHeight: 8,
  nodeTitleSize: 14,
  nodeMetaSize: 10,
  nodeSummarySize: 11,

  edgeLabelSize: 10,
  transitionEdgeStrong: "#2454CF",
  transitionEdgeMedium: "#6592EE",
  transitionEdgeWeak: "#A2BDF7",
  verticalEdgeColor: "#7E879A",
} as const;
