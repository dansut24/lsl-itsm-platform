import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const DESKTOP_SIDE_KEY = 'hi5central-primary-nav-side-v1'
const MOBILE_SIDE_KEY = 'hi5central-mobile-nav-side-v1'
const VALID_SIDES = new Set(['left', 'right'])

function readSide(key, fallback = 'left') {
  try {
    const raw = window.localStorage.getItem(key)
    const value = raw ? JSON.parse(raw) : fallback
    return VALID_SIDES.has(value) ? value : fallback
  } catch {
    return fallback
  }
}

function applySides(desktopSide, mobileSide) {
  const desktop = VALID_SIDES.has(desktopSide) ? desktopSide : 'left'
  const mobile = VALID_SIDES.has(mobileSide) ? mobileSide : 'left'
  document.documentElement.dataset.hi5NavSide = desktop
  document.documentElement.dataset.hi5MobileNavSide = mobile
  document.body.dataset.hi5NavSide = desktop
  document.body.dataset.hi5MobileNavSide = mobile

  const shell = document.querySelector('.app-shell')
  if (shell instanceof HTMLElement) {
    shell.dataset.navSide = desktop
    shell.dataset.mobileNavSide = mobile
  }
}

export function ProductionNavigationDockPreferences() {
  const [desktopSide, setDesktopSide] = useState(() => readSide(DESKTOP_SIDE_KEY))
  const [mobileSide, setMobileSide] = useState(() => readSide(MOBILE_SIDE_KEY))
  const [settingsTarget, setSettingsTarget] = useState(null)

  useEffect(() => {
    applySides(desktopSide, mobileSide)
    try {
      window.localStorage.setItem(DESKTOP_SIDE_KEY, JSON.stringify(desktopSide))
      window.localStorage.setItem(MOBILE_SIDE_KEY, JSON.stringify(mobileSide))
    } catch {
      // Per-browser accessibility preference only.
    }
    window.dispatchEvent(new CustomEvent('hi5-navigation-side-change', {
      detail: { desktopSide, mobileSide },
    }))
  }, [desktopSide, mobileSide])

  useEffect(() => {
    const syncFromStorage = () => {
      setDesktopSide(readSide(DESKTOP_SIDE_KEY))
      setMobileSide(readSide(MOBILE_SIDE_KEY))
    }

    const scan = () => {
      applySides(readSide(DESKTOP_SIDE_KEY), readSide(MOBILE_SIDE_KEY))
      if (window.location.pathname !== '/settings/appearance') {
        setSettingsTarget(null)
        return
      }

      const panels = Array.from(document.querySelectorAll('.production-settings-panel'))
      const workspacePanel = panels.find((panel) => (
        panel.querySelector('h2')?.textContent?.trim().toLowerCase() === 'workspace navigation'
      ))
      const grid = workspacePanel?.querySelector('.production-settings-grid')
      setSettingsTarget(grid instanceof HTMLElement ? grid : null)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(scan, 700)
    window.addEventListener('hi5-routechange', scan)
    window.addEventListener('storage', syncFromStorage)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('hi5-routechange', scan)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [])

  if (!settingsTarget) return null

  return createPortal(
    <>
      <label className="production-settings-field hi5-navigation-side-field">
        <span>Desktop sidebar dock</span>
        <select value={desktopSide} onChange={(event) => setDesktopSide(event.target.value)}>
          <option value="left">Left side</option>
          <option value="right">Right side</option>
        </select>
        <small>Move the floating primary navigation to the side that is most comfortable to reach.</small>
      </label>

      <label className="production-settings-field hi5-navigation-side-field">
        <span>Mobile navigation button</span>
        <select value={mobileSide} onChange={(event) => setMobileSide(event.target.value)}>
          <option value="left">Left side</option>
          <option value="right">Right side</option>
        </select>
        <small>The floating drawer opens from the same side as the navigation button.</small>
      </label>
    </>,
    settingsTarget,
  )
}
