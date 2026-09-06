import { AlertCircle, CheckCircle2, LoaderCircle, LockKeyhole, SearchX, WifiOff } from 'lucide-react'
import './UiState.css'

const icons = {
  empty: SearchX,
  error: AlertCircle,
  loading: LoaderCircle,
  offline: WifiOff,
  permission: LockKeyhole,
  saved: CheckCircle2,
}

export function UiState({
  action,
  actionLabel = 'Try again',
  compact = false,
  description,
  title,
  type = 'empty',
}) {
  const Icon = icons[type] || SearchX

  return (
    <section className={`hi5-ui-state is-${type} ${compact ? 'is-compact' : ''}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="hi5-ui-state-icon"><Icon className={type === 'loading' ? 'is-spinning' : ''} size={22} aria-hidden="true" /></span>
      <div>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <button onClick={action} type="button">{actionLabel}</button> : null}
    </section>
  )
}

export function UiSkeleton({ lines = 4 }) {
  return (
    <div className="hi5-ui-skeleton" aria-label="Loading" role="status">
      {Array.from({ length: lines }).map((_, index) => <span key={index} />)}
    </div>
  )
}
