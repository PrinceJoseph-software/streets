'use client'

import { useState, useEffect } from 'react'

const LS_KEY = 'streets_tagline_dismissed'

export function HomeMasthead() {
  // Start hidden — read localStorage on mount to avoid SSR mismatch.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(LS_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(LS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="max-w-md mx-auto flex items-center justify-between pb-4">
      <p className="font-body text-sm text-mute">
        Find them before everybody else.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss tagline"
        className="font-mono text-xs text-mute opacity-40 hover:opacity-80 transition-opacity ml-4 leading-none"
      >
        ×
      </button>
    </div>
  )
}
