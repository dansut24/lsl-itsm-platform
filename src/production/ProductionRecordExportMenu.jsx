import { useRef, useState } from 'react'
import { ChevronDown, Download, LoaderCircle } from 'lucide-react'
import { RECORD_EXPORT_FORMATS } from '../lib/recordExport.js'
import './ProductionRecordExportMenu.css'

export function ProductionRecordExportMenu({ onExport, compact = false, className = '' }) {
  const [busy, setBusy] = useState('')
  const detailsRef = useRef(null)

  async function run(format) {
    if (busy) return
    setBusy(format)
    try {
      await onExport(format)
      if (detailsRef.current) detailsRef.current.open = false
    } finally {
      setBusy('')
    }
  }

  return (
    <details ref={detailsRef} className={`hi5-record-export-menu${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
      <summary title="Export"><Download size={16} /><span>Export</span><ChevronDown size={13} /></summary>
      <div className="hi5-record-export-popover">
        <header><strong>Export</strong><span>Download this view</span></header>
        {RECORD_EXPORT_FORMATS.map((format) => (
          <button type="button" key={format.id} disabled={Boolean(busy)} onClick={() => run(format.id)}>
            <span><strong>{format.label}</strong><small>{format.description}</small></span>
            {busy === format.id ? <LoaderCircle className="is-spinning" size={15} /> : <Download size={15} />}
          </button>
        ))}
      </div>
    </details>
  )
}
