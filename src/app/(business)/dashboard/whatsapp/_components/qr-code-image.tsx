'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface QrCodeImageProps {
  value: string   // wa.me deep link URL
  size?: number   // default 128
}

export function QrCodeImage({ value, size = 128 }: QrCodeImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, { width: size })
    }
  }, [value, size])

  return (
    <canvas
      ref={canvasRef}
      aria-label={`QR code for ${value}`}
    />
  )
}
