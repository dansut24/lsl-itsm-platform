import { useEffect, useState } from 'react'
import { ProductionActivityActionRecord } from './ProductionActivityActionRecord.jsx'
import { ProductionServiceRequestActivityRecord } from './ProductionServiceRequestActivityRecord.jsx'
import { ProductionServiceRequestWorkflowInspectorEnhancer } from './ProductionServiceRequestWorkflowInspectorEnhancer.jsx'
import { ProductionTaskExperience } from './ProductionTaskExperience.jsx'

function detailRoute(pathname = window.location.pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean)
  if (parts.length !== 2 || parts[1].toLowerCase() === 'new') return null
  const section = parts[0].toLowerCase()
  if (section === 'requests') return 'service-request'
  if (['incidents', 'problems', 'changes'].includes(section)) return 'generic'
  return null
}

export function ProductionRecordDetailRouter() {
  const [route, setRoute] = useState(() => detailRoute())

  useEffect(() => {
    let lastPath = window.location.pathname
    const update = () => {
      const nextPath = window.location.pathname
      if (nextPath === lastPath) return
      lastPath = nextPath
      setRoute(detailRoute(nextPath))
    }

    const forceUpdate = () => {
      lastPath = window.location.pathname
      setRoute(detailRoute(lastPath))
    }

    window.addEventListener('popstate', forceUpdate)
    window.addEventListener('hi5-routechange', forceUpdate)
    const timer = window.setInterval(update, 250)

    return () => {
      window.removeEventListener('popstate', forceUpdate)
      window.removeEventListener('hi5-routechange', forceUpdate)
      window.clearInterval(timer)
    }
  }, [])

  if (route === 'service-request') return <><ProductionServiceRequestActivityRecord /><ProductionServiceRequestWorkflowInspectorEnhancer /><ProductionTaskExperience /></>
  if (route === 'generic') return <><ProductionActivityActionRecord /><ProductionTaskExperience /></>
  return <ProductionTaskExperience />
}
