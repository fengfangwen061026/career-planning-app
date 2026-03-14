export const graphStyles = {
  // Background
  graphBg:
    "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e8eef7 100%)",

  // Glass effect
  glassBg: "rgba(255, 255, 255, 0.55)",
  glassBorder: "rgba(255, 255, 255, 0.8)",
  glassShadow:
    "0 8px 32px rgba(99, 102, 241, 0.08), 0 2px 8px rgba(0,0,0,0.06)",
  glassBlur: "blur(20px)",

  // Node sizes
  rootNodeRadius: 36,
  categoryNodeRadius: 28,
  jobNodeRadius: 20,
  selectedNodeRadius: 24,

  // Strokes
  categoryStrokeWidth: 1.5,
  categoryStrokeOpacity: 0.6,
  jobStrokeWidth: 1,
  jobStrokeOpacity: 0.4,

  // Lines
  lineColor: "rgba(148, 163, 184, 0.4)",
  lineWidth: 1.2,

  // Selected glow
  selectedGlow: "drop-shadow(0 0 12px currentColor)",

  // Fonts
  categoryFontSize: 12,
  jobFontSize: 9,
  iconFontSize: 16,
  badgeFontSize: 8,

  // Animations
  transitionDuration: 500,
  staggerDelay: {
    category: 80,
    job: 20,
  },
} as const;
