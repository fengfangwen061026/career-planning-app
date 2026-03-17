export const graphStyles = {
  fontFamily:
    "-apple-system, 'PingFang SC', 'SF Pro Display', 'Helvetica Neue', sans-serif",
  pageBackground:
    "linear-gradient(135deg, #F8F9FF 0%, #F0F4FF 50%, #F8FFF8 100%)",
  primary: "#4F46E5",
  gray900: "#0A0A0A",
  gray700: "#374151",
  gray500: "#6B7280",
  gray200: "#E5E7EB",

  rootNodeRadius: 32,
  categoryNodeRadius: 24,
  jobNodeRadius: 15,
  selectedJobScale: 1.1,

  rootFontSize: 13,
  categoryFontSize: 11,
  jobFontSize: 9,
  iconFontSize: 13,
  badgeFontSize: 7,

  lineWidth: 1,
  interactionDuration: 150,

  enterDelay: {
    root: 0,
    categories: 100,
    jobs: 500,
  },
} as const;
