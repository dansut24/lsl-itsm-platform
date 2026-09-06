import { useMemo, useState } from 'react'
import {
  Check,
  ChevronLeft,
  CreditCard,
  FileText,
  PackageOpen,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  Tag,
  UsersRound,
  X,
} from 'lucide-react'
import { portalServiceCatalog } from '../../data/portalData.js'
import './ServiceCatalogueAdmin.css'

const STORAGE_KEY = 'hi5central-service-catalogue-admin-v1'
const ALL_ITEMS = 'All items'

function money(value) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(Number(value || 0))
}

function seedItemsFromPortal() {
  const requestItems = portalServiceCatalog.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    description: item.description,
    kind: 'request-form',
    requestType: item.requestType,
    service: item.service,
    team: item.team,
    approval: item.approval || 'none',
    visibility: 'portal',
    vendor: '',
    sku: '',
    priceMode: item.fields?.some((field) => ['product', 'checkbox-products'].includes(field.type)) ? 'calculated' : 'none',
    oneOffPrice: 0,
    monthlyPrice: 0,
    workflow: `${item.service || 'Service'} fulfilment`,
    optionsCount: item.fields?.length || 0,
    source: 'portal-seed',
    active: true,
  }))

  const products = new Map()
  portalServiceCatalog.forEach((form) => {
    ;(form.fields || []).forEach((field) => {
      if (!['product', 'checkbox-products'].includes(field.type)) return
      ;(field.options || []).forEach((option) => {
        if (!option.itemId || products.has(option.itemId)) return
        const monthly = option.recurring === 'monthly'
        products.set(option.itemId, {
          id: option.itemId,
          title: option.label,
          category: option.category || form.category || 'Uncategorised',
          description: `Selectable catalogue product used by ${form.title}.`,
          kind: 'product',
          requestType: 'Service Request',
          service: form.service || 'Service Catalogue',
          team: form.team || 'Service Desk',
          approval: form.approval || 'manager-cost',
          visibility: 'portal',
          vendor: option.label.includes('Microsoft') || option.label.includes('Visio') || option.label.includes('Project') || option.label.includes('Power BI') ? 'Microsoft' : option.label.includes('Lenovo') ? 'Lenovo' : '',
          sku: '',
          priceMode: 'fixed',
          oneOffPrice: monthly ? 0 : Number(option.cost || 0),
          monthlyPrice: monthly ? Number(option.cost || 0) : 0,
          workflow: `${form.service || 'Catalogue'} fulfilment`,
          optionsCount: 0,
          source: 'portal-seed',
          active: true,
        })
      })
    })
  })

  return [...requestItems, ...products.values()]
}

function defaultState() {
  const items = seedItemsFromPortal()
  return {
    items,
    categories: [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  }
}

function loadCatalogue() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    if (!stored || !Array.isArray(stored.items)) return defaultState()
    const defaults = defaultState()
    const byId = new Map(defaults.items.map((item) => [item.id, item]))
    const items = stored.items.map((item) => ({ ...byId.get(item.id), ...item }))
    defaults.items.forEach((item) => { if (!items.some((candidate) => candidate.id === item.id)) items.push(item) })
    const categories = [...new Set([...(stored.categories || []), ...items.map((item) => item.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b))
    return { items, categories }
  } catch {
    return defaultState()
  }
}

function saveCatalogue(value) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('hi5-service-catalogue-changed', { detail: value }))
}

function itemPrice(item) {
  if (item.priceMode === 'calculated') return 'Calculated from selections'
  const oneOff = Number(item.oneOffPrice || 0)
  const monthly = Number(item.monthlyPrice || 0)
  if (oneOff && monthly) return `${money(oneOff)} + ${money(monthly)}/mo`
  if (monthly) return `${money(monthly)}/mo`
  if (oneOff) return money(oneOff)
  return 'No charge'
}

function kindLabel(kind) {
  return kind === 'product' ? 'Product' : 'Request form'
}

function ItemEditor({ categories, item, onClose, onSave }) {
  const creating = !item
  const [draft, setDraft] = useState(() => item ? { ...item } : {
    id: '',
    title: '',
    category: categories[0] || 'General',
    description: '',
    kind: 'product',
    requestType: 'Service Request',
    service: 'Service Catalogue',
    team: 'Service Desk',
    approval: 'manager-cost',
    visibility: 'portal',
    vendor: '',
    sku: '',
    priceMode: 'fixed',
    oneOffPrice: 0,
    monthlyPrice: 0,
    workflow: 'Default fulfilment',
    optionsCount: 0,
    source: 'local-demo',
    active: true,
  })

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function submit(event) {
    event.preventDefault()
    const generatedId = `CAT-${String(draft.title || 'ITEM').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)}-${Date.now().toString().slice(-4)}`
    onSave({
      ...draft,
      id: draft.id || generatedId,
      oneOffPrice: Number(draft.oneOffPrice || 0),
      monthlyPrice: Number(draft.monthlyPrice || 0),
    })
  }

  return (
    <div className="catalogue-editor-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="catalogue-editor" aria-label={creating ? 'New catalogue item' : `Edit ${item.title}`}>
        <header><div><span>Service catalogue</span><strong>{creating ? 'New item' : item.title}</strong></div><button aria-label="Close" onClick={onClose} type="button"><X size={19} /></button></header>
        <form onSubmit={submit}>
          <section>
            <div className="catalogue-editor-heading"><span>Identity</span><strong>Catalogue item</strong></div>
            <div className="catalogue-form-grid two">
              <label>Item type<select value={draft.kind} onChange={(event) => update('kind', event.target.value)}><option value="product">Product</option><option value="request-form">Request form</option></select></label>
              <label>Category<select value={draft.category} onChange={(event) => update('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            </div>
            <label>Name<input autoFocus required value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
            <label>Description<textarea rows="4" value={draft.description || ''} onChange={(event) => update('description', event.target.value)} /></label>
          </section>

          <section>
            <div className="catalogue-editor-heading"><span>Commercial</span><strong>Cost & product data</strong></div>
            <div className="catalogue-form-grid two">
              <label>Pricing<select value={draft.priceMode} onChange={(event) => update('priceMode', event.target.value)}><option value="none">No charge</option><option value="fixed">Fixed price</option><option value="calculated">Calculated from options</option></select></label>
              <label>Vendor<input value={draft.vendor || ''} onChange={(event) => update('vendor', event.target.value)} placeholder="Microsoft, Lenovo…" /></label>
            </div>
            <div className="catalogue-form-grid two">
              <label>One-off price (£)<input disabled={draft.priceMode !== 'fixed'} min="0" step="0.01" type="number" value={draft.oneOffPrice || 0} onChange={(event) => update('oneOffPrice', event.target.value)} /></label>
              <label>Monthly price (£)<input disabled={draft.priceMode !== 'fixed'} min="0" step="0.01" type="number" value={draft.monthlyPrice || 0} onChange={(event) => update('monthlyPrice', event.target.value)} /></label>
            </div>
            <label>Vendor SKU<input value={draft.sku || ''} onChange={(event) => update('sku', event.target.value)} /></label>
          </section>

          <section>
            <div className="catalogue-editor-heading"><span>Fulfilment</span><strong>Routing & approval</strong></div>
            <div className="catalogue-form-grid two">
              <label>Request type<select value={draft.requestType} onChange={(event) => update('requestType', event.target.value)}><option>Service Request</option><option>Incident</option></select></label>
              <label>Service<input value={draft.service || ''} onChange={(event) => update('service', event.target.value)} /></label>
            </div>
            <div className="catalogue-form-grid two">
              <label>Fulfilment team<input value={draft.team || ''} onChange={(event) => update('team', event.target.value)} /></label>
              <label>Approval<select value={draft.approval || 'none'} onChange={(event) => update('approval', event.target.value)}><option value="none">No approval</option><option value="manager">Manager</option><option value="manager-cost">Manager / cost policy</option><option value="custom">Custom workflow</option></select></label>
            </div>
            <label>Fulfilment workflow<input value={draft.workflow || ''} onChange={(event) => update('workflow', event.target.value)} /></label>
          </section>

          <section>
            <div className="catalogue-editor-heading"><span>Experience</span><strong>Visibility</strong></div>
            <label>Visible to<select value={draft.visibility || 'portal'} onChange={(event) => update('visibility', event.target.value)}><option value="portal">Portal + technicians</option><option value="technicians">Technicians only</option><option value="hidden">Hidden / draft</option></select></label>
            <label className="catalogue-toggle"><input checked={draft.active !== false} onChange={(event) => update('active', event.target.checked)} type="checkbox" /><span><strong>Active item</strong><small>Inactive items remain available for historic request snapshots.</small></span></label>
          </section>

          <footer><button className="secondary-action" onClick={onClose} type="button">Cancel</button><button className="primary-action" type="submit"><Check size={17} /> Save item</button></footer>
        </form>
      </aside>
    </div>
  )
}

export function ServiceCatalogueAdmin() {
  const [catalogue, setCatalogue] = useState(loadCatalogue)
  const [activeCategory, setActiveCategory] = useState(ALL_ITEMS)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [editorItem, setEditorItem] = useState(undefined)
  const [categoryDraftOpen, setCategoryDraftOpen] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState('')

  const categoryRows = useMemo(() => [
    { id: ALL_ITEMS, label: ALL_ITEMS, count: catalogue.items.length },
    ...catalogue.categories.map((category) => ({ id: category, label: category, count: catalogue.items.filter((item) => item.category === category).length })),
  ], [catalogue])

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return catalogue.items.filter((item) => {
      const searchable = [item.id, item.title, item.category, item.description, item.vendor, item.sku, item.service, item.team].join(' ').toLowerCase()
      return (activeCategory === ALL_ITEMS || item.category === activeCategory)
        && (!needle || searchable.includes(needle))
        && (kindFilter === 'All' || item.kind === kindFilter)
        && (statusFilter === 'All' || (statusFilter === 'Active' ? item.active !== false : item.active === false))
    })
  }, [activeCategory, catalogue.items, kindFilter, query, statusFilter])

  function persist(next) {
    setCatalogue(next)
    saveCatalogue(next)
  }

  function saveItem(item) {
    const items = catalogue.items.some((candidate) => candidate.id === item.id)
      ? catalogue.items.map((candidate) => candidate.id === item.id ? item : candidate)
      : [...catalogue.items, item]
    const categories = [...new Set([...catalogue.categories, item.category].filter(Boolean))].sort((a, b) => a.localeCompare(b))
    persist({ items, categories })
    setEditorItem(undefined)
  }

  function createCategory(event) {
    event.preventDefault()
    const category = categoryDraft.trim()
    if (!category) return
    const categories = [...new Set([...catalogue.categories, category])].sort((a, b) => a.localeCompare(b))
    persist({ ...catalogue, categories })
    setActiveCategory(category)
    setCategoryDraft('')
    setCategoryDraftOpen(false)
  }

  const activeItems = catalogue.items.filter((item) => item.active !== false).length
  const portalItems = catalogue.items.filter((item) => item.active !== false && item.visibility === 'portal').length
  const productItems = catalogue.items.filter((item) => item.kind === 'product').length

  return (
    <div className="service-catalogue-admin">
      <aside className="catalogue-category-rail">
        <header><div><span>ITSM</span><strong>Catalogue categories</strong></div><PackageOpen size={18} /></header>
        <nav>{categoryRows.map((category) => <button className={activeCategory === category.id ? 'is-active' : ''} key={category.id} onClick={() => setActiveCategory(category.id)} type="button"><Tag size={15} /><span>{category.label}</span><small>{category.count}</small></button>)}</nav>
        <footer>
          {categoryDraftOpen ? <form onSubmit={createCategory}><input autoFocus placeholder="Category name" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} /><div><button onClick={() => { setCategoryDraftOpen(false); setCategoryDraft('') }} type="button">Cancel</button><button type="submit">Add</button></div></form> : <button onClick={() => setCategoryDraftOpen(true)} type="button"><Plus size={15} /> New category</button>}
        </footer>
      </aside>

      <section className="catalogue-content-surface">
        <header className="catalogue-page-heading">
          <div><span className="eyebrow">ITSM administration</span><h2>Service catalogue</h2><p>Define request experiences, products, pricing, approvals and fulfilment metadata before the catalogue moves to PostgreSQL.</p></div>
          <button className="primary-action" onClick={() => setEditorItem(null)} type="button"><Plus size={18} /> New item</button>
        </header>

        <div className="catalogue-stat-grid">
          <article><PackageOpen size={19} /><div><strong>{activeItems}</strong><span>Active items</span></div></article>
          <article><ShoppingBag size={19} /><div><strong>{productItems}</strong><span>Products</span></div></article>
          <article><FileText size={19} /><div><strong>{catalogue.items.length - productItems}</strong><span>Request forms</span></div></article>
          <article><UsersRound size={19} /><div><strong>{portalItems}</strong><span>Portal visible</span></div></article>
        </div>

        <div className="catalogue-toolbar">
          <label className="catalogue-search"><Search size={18} /><input placeholder="Search catalogue, vendor, SKU or service" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label><span>Type</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option>All</option><option value="product">Products</option><option value="request-form">Request forms</option></select></label>
          <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label>
        </div>

        <div className="catalogue-item-grid">
          {visibleItems.map((item) => (
            <article className={`catalogue-item-card ${item.active === false ? 'is-inactive' : ''}`} key={item.id}>
              <header><span className="catalogue-item-icon">{item.kind === 'product' ? <ShoppingBag size={20} /> : <FileText size={20} />}</span><div className="catalogue-item-actions"><span>{kindLabel(item.kind)}</span><button aria-label={`Edit ${item.title}`} onClick={() => setEditorItem(item)} type="button"><Settings2 size={17} /></button></div></header>
              <div className="catalogue-item-title"><span>{item.category}</span><h3>{item.title}</h3><p>{item.description}</p></div>
              <div className="catalogue-price"><CreditCard size={17} /><span><small>Price</small><strong>{itemPrice(item)}</strong></span></div>
              <dl>
                <div><dt>Service</dt><dd>{item.service || 'Not set'}</dd></div>
                <div><dt>Team</dt><dd>{item.team || 'Not set'}</dd></div>
                <div><dt>Approval</dt><dd>{item.approval || 'none'}</dd></div>
                <div><dt>Visibility</dt><dd>{item.visibility === 'portal' ? 'Portal + technicians' : item.visibility === 'technicians' ? 'Technicians only' : 'Hidden'}</dd></div>
                {item.vendor ? <div><dt>Vendor</dt><dd>{item.vendor}</dd></div> : null}
                {item.sku ? <div><dt>SKU</dt><dd>{item.sku}</dd></div> : null}
              </dl>
              <footer><span className={item.active === false ? 'is-inactive' : 'is-active'}>{item.active === false ? 'Inactive' : 'Active'}</span><small>{item.workflow || 'Default fulfilment'}</small></footer>
            </article>
          ))}
        </div>

        {!visibleItems.length ? <div className="catalogue-empty"><PackageOpen size={30} /><strong>No catalogue items found</strong><span>Try a different category, search or filter.</span></div> : null}
      </section>

      {editorItem !== undefined ? <ItemEditor categories={catalogue.categories} item={editorItem} onClose={() => setEditorItem(undefined)} onSave={saveItem} /> : null}
    </div>
  )
}
