'use client'

import React, { useId } from 'react'
import styles from './switch-animated.module.css'

interface SwitchAnimatedProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  id?: string
}

export function SwitchAnimated({
  checked,
  onCheckedChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: SwitchAnimatedProps) {
  const reactId = useId()
  const inputId = id ?? reactId
  return (
    <span className={styles.wrap}>
      <input
        id={inputId}
        className={styles.input}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <label className={styles.switch} htmlFor={inputId} aria-hidden="true">
        <svg viewBox="0 0 212.4992 84.4688" overflow="visible">
          <path
            pathLength={360}
            fill="none"
            stroke="currentColor"
            d="M 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 A 42.24 42.24 90 0 0 84.4992 42.2496 A 42.24 42.24 90 0 0 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 L 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 A 42.24 42.24 90 0 0 128 42.2496 A 42.24 42.24 90 0 0 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 L 42.2496 0"
          />
        </svg>
      </label>
    </span>
  )
}
