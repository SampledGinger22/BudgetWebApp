import type { ThemeConfig } from 'antd'

// ─── Color constants ───────────────────────────────────────────────────────────
// All foreground colors verified WCAG AA (≥4.5:1) against cream background #F5F0E8
// Terracotta #A95537: 4.58:1 against cream — PASS
// Sage        #567559: 4.53:1 against cream — PASS
// Warm red    #B94040: 4.78:1 against cream — PASS
// Copper      #986028: 4.58:1 against cream — PASS
// Oak         #8A6814: 4.55:1 against cream — PASS
// Walnut      #5C3D1E: 8.65:1 against cream — PASS
export const COLORS = {
  terracotta: '#A95537',
  cream: '#F5F0E8',
  creamDark: '#EDE8DE',
  sage: '#567559',
  warmRed: '#B94040',
  copper: '#986028',
  oak: '#8A6814',
  walnut: '#5C3D1E',
} as const

// Monospace font stack for monetary values — system stack, no extra download
export const MONEY_FONT = "ui-monospace, 'Cascadia Code', 'Consolas', monospace"

// ─── Ant Design theme configuration ───────────────────────────────────────────
export const earthyTheme: ThemeConfig = {
  token: {
    // Primary action: terracotta
    colorPrimary: COLORS.terracotta,
    // Success / positive: sage
    colorSuccess: COLORS.sage,
    // Error / negative values: warm red
    colorError: COLORS.warmRed,
    // Warning: copper-adjacent
    colorWarning: COLORS.copper,
    // Background: cream
    colorBgBase: COLORS.cream,
    colorBgContainer: COLORS.cream,
    colorBgLayout: COLORS.creamDark,
    // Typography
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    // Motion — tightened to match 150ms spec
    motionDurationMid: '0.15s',
    motionDurationSlow: '0.2s',
    motionDurationFast: '0.1s',
    // Border radius
    borderRadius: 6,
    // Font sizes
    fontSize: 14,
  },
  components: {
    Layout: {
      siderBg: COLORS.creamDark,
      headerBg: COLORS.cream,
    },
    Menu: {
      itemBg: COLORS.creamDark,
      itemSelectedBg: 'rgba(169, 85, 55, 0.12)',
      itemSelectedColor: COLORS.terracotta,
      itemHoverBg: 'rgba(169, 85, 55, 0.07)',
      itemHoverColor: COLORS.terracotta,
    },
  },
}
