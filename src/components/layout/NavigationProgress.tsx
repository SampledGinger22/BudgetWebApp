'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { COLORS } from '@/theme'

/**
 * Thin progress bar at the top of the content area.
 * Shows during route transitions to give instant visual feedback.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)

  useEffect(() => {
    if (pathname !== prevPathname) {
      // Route changed — hide the bar
      setLoading(false)
      setPrevPathname(pathname)
    }
  }, [pathname, prevPathname])

  // Listen for route change start via click on navigation links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (href && href.startsWith('/') && href !== pathname) {
        setLoading(true)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname])

  if (!loading) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 100,
        overflow: 'hidden',
        backgroundColor: `rgba(169, 85, 55, 0.1)`,
      }}
    >
      <div
        style={{
          height: '100%',
          backgroundColor: COLORS.terracotta,
          animation: 'nav-progress 2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes nav-progress {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}
