/**
 * HEX colors for Satori/OG rendering derived from globals.css OKLCH tokens.
 * OG environments do not reliably support OKLCH, so keep this palette in HEX/RGBA.
 */
export const OG_HEX_COLORS = {
  background: '#050911',
  surface: '#11161f',
  surfaceAlt: '#282e38',
  foreground: '#f1f5fc',
  muted: '#c9d2de',
  primary: '#2d88e2',
  warning: '#e6ac3d',
  success: '#4aad65',
  info: '#25afd2',
} as const

export const OG_ALPHA = {
  warningGlow: 'rgba(230,172,61,0.26)',
  successGlow: 'rgba(74,173,101,0.2)',
  infoGlow: 'rgba(37,175,210,0.2)',
  warningChip: 'rgba(230,172,61,0.18)',
  warningBorder: 'rgba(230,172,61,0.45)',
  mutedBorder: 'rgba(201,210,222,0.45)',
  mutedBorderSoft: 'rgba(201,210,222,0.35)',
  mutedBorderSofter: 'rgba(201,210,222,0.32)',
  surfaceTint: 'rgba(17,22,31,0.62)',
  shadow: 'rgba(0,0,0,0.55)',
} as const
