import localFont from 'next/font/local'

// Landing display face. Self-hosted from Fontshare (free license).
export const clashDisplay = localFont({
  variable: '--font-display',
  display: 'swap',
  src: [
    { path: './ClashDisplay-Medium.woff2', weight: '500', style: 'normal' },
    { path: './ClashDisplay-Semibold.woff2', weight: '600', style: 'normal' },
    { path: './ClashDisplay-Bold.woff2', weight: '700', style: 'normal' },
  ],
})
