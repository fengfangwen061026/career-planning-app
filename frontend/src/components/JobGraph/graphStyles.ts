export const graphStyles = {
  fontFamily:
    "-apple-system, 'PingFang SC', 'SF Pro Display', 'Helvetica Neue', sans-serif",
  pageBackground:
    "linear-gradient(135deg, #F8F9FF 0%, #F0F4FF 50%, #F8FFF8 100%)",
  primary: "#4F46E5",
  gray900: "#0A0A0A",
  gray700: "#374151",
  gray500: "#6B7280",
  gray300: "#D1D5DB",
  gray200: "#E5E7EB",

  rootNodeRadius: 34,
  categoryCardWidth: 126,
  categoryCardHeight: 74,
  jobNodeRadius: 16,
  selectedJobScale: 1.08,

  rootFontSize: 13,
  categoryFontSize: 12,
  categoryMetaFontSize: 10,
  jobFontSize: 9,
  iconFontSize: 14,
  badgeFontSize: 7,

  lineWidth: 1,
  interactionDuration: 180,
  layoutDuration: 400,
  fadedOpacity: 0.15,

  enterDelay: {
    root: 0,
    categories: 80,
    jobs: 140,
  },
} as const;
