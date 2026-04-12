export const graphStyles = {
  fontFamily:
    '"PingFang SC", "SF Pro Display", "Segoe UI", -apple-system, sans-serif',
  pageBackground:
    "radial-gradient(ellipse at 30% 20%, #EEF4FF 0%, #F8FAFF 50%, #F0FFF8 100%)",

  // 文字颜色
  gray900: "#111827",
  gray700: "#374151",
  gray500: "#6B7280",
  gray300: "#D1D5DB",
  gray100: "#F3F4F6",

  // 节点尺寸：改为统一的椭圆/胶囊，不再按 heat 分三档
  nodePillHeight: 52,
  nodePillPaddingX: 20,
  nodePillMinWidth: 108,
  nodePillMaxWidth: 160,
  nodePillRx: 26,

  // 节点文字
  nodeTitleSize: 13,
  nodeMetaSize: 10,

  // 边线样式
  transitionEdgeStrong: "#3B6FE8",
  transitionEdgeMedium: "#7CA3F0",
  transitionEdgeWeak: "#B3CAF8",
  verticalEdgeColor: "#94A3B8",
  edgeLabelSize: 9,

  // 层级背景带颜色（半透明）
  bandColors: {
    entry: "rgba(239,246,255,0.55)",
    growing: "rgba(240,253,244,0.55)",
    stable: "rgba(255,251,235,0.45)",
    mature: "rgba(255,241,242,0.40)",
    expert: "rgba(245,243,255,0.45)",
    unknown: "rgba(248,250,252,0.40)",
  } as Record<string, string>,

  // 社区背景色（浅色，用于节点填充）
  communityFills: [
    "#EEF2FF",
    "#ECFDF5",
    "#FFF7ED",
    "#FFF1F2",
    "#F5F3FF",
    "#F0FDF4",
    "#FFF5F5",
    "#EFF6FF",
  ] as string[],

  communityStrokes: [
    "#2F6FED",
    "#159A9C",
    "#E07A2E",
    "#C85272",
    "#7C6DC8",
    "#4D7C57",
    "#B75D69",
    "#4E6FA8",
  ] as string[],
} as const;
