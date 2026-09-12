export const portalServiceCatalog = []

export function portalFieldVisible(field, values = {}) {
  if (!field.showWhen) return true
  const current = values[field.showWhen.field]
  if (Object.prototype.hasOwnProperty.call(field.showWhen, 'equals')) return current === field.showWhen.equals
  if (Array.isArray(field.showWhen.oneOf)) return field.showWhen.oneOf.includes(current)
  return true
}

export function portalCatalogueCost(item, values = {}) {
  if (!item) return { oneOff: 0, monthly: 0, items: [] }
  const result = { oneOff: 0, monthly: 0, items: [] }

  item.fields.forEach((field) => {
    if (!portalFieldVisible(field, values)) return
    if (field.type === 'product') {
      const option = (field.options || []).find((candidate) => candidate.value === values[field.id])
      if (!option) return
      const snapshot = {
        id: option.itemId,
        name: option.label,
        category: option.category || item.category,
        quantity: 1,
        unitCost: Number(option.cost || 0),
        recurring: option.recurring || '',
        options: [field.label],
      }
      result.items.push(snapshot)
      if (option.recurring === 'monthly') result.monthly += snapshot.unitCost
      else result.oneOff += snapshot.unitCost
    }
    if (field.type === 'checkbox-products') {
      const selected = Array.isArray(values[field.id]) ? values[field.id] : []
      ;(field.options || []).filter((option) => selected.includes(option.value)).forEach((option) => {
        const snapshot = {
          id: option.itemId,
          name: option.label,
          category: option.category || item.category,
          quantity: 1,
          unitCost: Number(option.cost || 0),
          recurring: option.recurring || '',
          options: [field.label],
        }
        result.items.push(snapshot)
        if (option.recurring === 'monthly') result.monthly += snapshot.unitCost
        else result.oneOff += snapshot.unitCost
      })
    }
  })

  return result
}

export function portalRequestInformation(item, values = {}) {
  if (!item) return []
  return item.fields
    .filter((field) => portalFieldVisible(field, values))
    .map((field) => {
      const raw = values[field.id]
      const value = Array.isArray(raw) ? raw.join(', ') : raw
      return value ? { label: field.label, value } : null
    })
    .filter(Boolean)
}
