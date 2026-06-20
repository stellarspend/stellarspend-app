import React from 'react'

interface ProgressProps {
  value: number
  className?: string
  indicatorClassName?: string
}

export function Progress({ value, className = '', indicatorClassName = 'bg-primary' }: ProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100)

  return (
    <div className={`relative h-4 w-full overflow-hidden rounded-full bg-secondary ${className}`}>
      <div
        className={`h-full w-full flex-1 transition-all ${indicatorClassName}`}
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
    </div>
  )
}
