export const portalServiceCatalog = [
  {
    id: 'CAT-ISSUE',
    title: 'Report an IT Issue',
    category: 'Get help',
    description: 'Something is broken, slow, unavailable or not working as expected.',
    requestType: 'Incident',
    service: 'IT Support',
    team: 'Service Desk',
    basePriority: 'Medium',
    approval: 'none',
    fields: [
      { id: 'affectedService', label: 'Affected service', type: 'select', required: true, options: ['Microsoft 365', 'Device / hardware', 'Network / VPN', 'Business application', 'Printing', 'Other'] },
      { id: 'impact', label: 'Who is affected?', type: 'select', required: true, options: ['Just me', 'Several people', 'A whole team / location'] },
      { id: 'started', label: 'When did it start?', type: 'datetime-local', required: false },
      { id: 'errorMessage', label: 'Error message', type: 'text', required: false, placeholder: 'Paste or type the exact error if you have one' },
    ],
  },
  {
    id: 'CAT-EQUIPMENT',
    title: 'Request Equipment',
    category: 'Hardware',
    description: 'Order a laptop, monitor, dock, headset or other workplace equipment.',
    requestType: 'Service Request',
    service: 'Hardware',
    team: 'End User Compute',
    basePriority: 'Medium',
    approval: 'manager-cost',
    fields: [
      {
        id: 'device',
        label: 'Primary item',
        type: 'product',
        required: true,
        options: [
          { value: 'ThinkPad T14', label: 'Lenovo ThinkPad T14', cost: 1150, itemId: 'CAT-HW-T14', category: 'Hardware' },
          { value: 'MacBook Air', label: 'MacBook Air 13"', cost: 1249, itemId: 'CAT-HW-MBA13', category: 'Hardware' },
          { value: '27 Monitor', label: '27" USB-C Monitor', cost: 299, itemId: 'CAT-HW-MON27', category: 'Hardware' },
          { value: 'USB-C Dock', label: 'USB-C Dock', cost: 189, itemId: 'CAT-HW-DOCK', category: 'Hardware' },
          { value: 'Headset', label: 'Teams-certified headset', cost: 89, itemId: 'CAT-HW-HEADSET', category: 'Hardware' },
        ],
      },
      {
        id: 'accessories',
        label: 'Optional accessories',
        type: 'checkbox-products',
        required: false,
        options: [
          { value: 'Wireless keyboard and mouse', label: 'Wireless keyboard + mouse', cost: 74, itemId: 'CAT-HW-KBM', category: 'Hardware' },
          { value: 'Laptop bag', label: 'Laptop bag', cost: 39, itemId: 'CAT-HW-BAG', category: 'Hardware' },
          { value: 'Privacy filter', label: 'Privacy filter', cost: 55, itemId: 'CAT-HW-PRIVACY', category: 'Hardware' },
        ],
      },
      { id: 'requiredBy', label: 'Required by', type: 'date', required: false },
      { id: 'businessReason', label: 'Business reason', type: 'textarea', required: true, placeholder: 'Why is this equipment needed?' },
    ],
  },
  {
    id: 'CAT-ACCESS',
    title: 'Access Request',
    category: 'Access',
    description: 'Request access to an application, shared mailbox, folder, VPN or business system.',
    requestType: 'Service Request',
    service: 'Access',
    team: 'Service Desk',
    basePriority: 'Medium',
    approval: 'manager',
    fields: [
      { id: 'system', label: 'Application or resource', type: 'select', required: true, options: ['Microsoft 365', 'Shared mailbox', 'Shared drive / folder', 'VPN', 'Finance system', 'HR system', 'Other'] },
      { id: 'otherSystem', label: 'Other application / resource', type: 'text', required: true, showWhen: { field: 'system', equals: 'Other' } },
      { id: 'accessLevel', label: 'Access required', type: 'select', required: true, options: ['Standard user', 'Read only', 'Contributor', 'Approver', 'Privileged / admin'] },
      { id: 'requiredBy', label: 'Required by', type: 'date', required: false },
      { id: 'businessReason', label: 'Business justification', type: 'textarea', required: true },
    ],
  },
  {
    id: 'CAT-ONBOARDING',
    title: 'New Starter',
    category: 'People',
    description: 'Arrange a starter account, device, licences and standard workplace access.',
    requestType: 'Service Request',
    service: 'Onboarding',
    team: 'Service Desk',
    basePriority: 'Medium',
    approval: 'manager-cost',
    fields: [
      { id: 'starterName', label: 'Starter name', type: 'text', required: true },
      { id: 'jobTitle', label: 'Job title', type: 'text', required: true },
      { id: 'startDate', label: 'Start date', type: 'date', required: true },
      { id: 'location', label: 'Work location', type: 'select', required: true, options: ['London HQ', 'Manchester', 'Birmingham', 'Remote', 'Other'] },
      {
        id: 'device',
        label: 'Device',
        type: 'product',
        required: true,
        options: [
          { value: 'Standard Windows laptop', label: 'Standard Windows laptop', cost: 950, itemId: 'CAT-HW-STARTER-WIN', category: 'Hardware' },
          { value: 'Power-user Windows laptop', label: 'Power-user Windows laptop', cost: 1450, itemId: 'CAT-HW-STARTER-PRO', category: 'Hardware' },
          { value: 'MacBook Air', label: 'MacBook Air', cost: 1249, itemId: 'CAT-HW-STARTER-MAC', category: 'Hardware' },
        ],
      },
      {
        id: 'licence',
        label: 'Microsoft 365 licence',
        type: 'product',
        required: true,
        options: [
          { value: 'M365 E3', label: 'Microsoft 365 E3', cost: 31, recurring: 'monthly', itemId: 'CAT-SW-M365-E3', category: 'Software' },
          { value: 'M365 F3', label: 'Microsoft 365 F3', cost: 8, recurring: 'monthly', itemId: 'CAT-SW-M365-F3', category: 'Software' },
        ],
      },
      { id: 'additionalAccess', label: 'Additional systems / notes', type: 'textarea', required: false },
    ],
  },
  {
    id: 'CAT-SOFTWARE',
    title: 'Request Software',
    category: 'Software',
    description: 'Request approved software or a business application licence.',
    requestType: 'Service Request',
    service: 'Software',
    team: 'Service Desk',
    basePriority: 'Low',
    approval: 'manager-cost',
    fields: [
      {
        id: 'software',
        label: 'Software',
        type: 'product',
        required: true,
        options: [
          { value: 'Adobe Acrobat Pro', label: 'Adobe Acrobat Pro', cost: 20, recurring: 'monthly', itemId: 'CAT-SW-ACROBAT', category: 'Software' },
          { value: 'Visio Plan 2', label: 'Visio Plan 2', cost: 12, recurring: 'monthly', itemId: 'CAT-SW-VISIO', category: 'Software' },
          { value: 'Project Plan 3', label: 'Project Plan 3', cost: 25, recurring: 'monthly', itemId: 'CAT-SW-PROJECT', category: 'Software' },
          { value: 'Power BI Pro', label: 'Power BI Pro', cost: 14, recurring: 'monthly', itemId: 'CAT-SW-PBI', category: 'Software' },
        ],
      },
      { id: 'device', label: 'Device / asset tag', type: 'text', required: false },
      { id: 'businessReason', label: 'Business justification', type: 'textarea', required: true },
    ],
  },
  {
    id: 'CAT-MOBILE',
    title: 'Mobile & Telephony',
    category: 'Hardware',
    description: 'Request a work mobile, SIM, number change or telephony accessory.',
    requestType: 'Service Request',
    service: 'Telephony',
    team: 'End User Compute',
    basePriority: 'Low',
    approval: 'manager-cost',
    fields: [
      { id: 'request', label: 'What do you need?', type: 'select', required: true, options: ['New work mobile', 'Replacement mobile', 'SIM / eSIM', 'Number change', 'Accessory'] },
      {
        id: 'mobile',
        label: 'Device',
        type: 'product',
        required: true,
        showWhen: { field: 'request', oneOf: ['New work mobile', 'Replacement mobile'] },
        options: [
          { value: 'iPhone standard', label: 'iPhone standard model', cost: 699, itemId: 'CAT-MOB-IPHONE', category: 'Mobile' },
          { value: 'Android standard', label: 'Android standard model', cost: 499, itemId: 'CAT-MOB-ANDROID', category: 'Mobile' },
        ],
      },
      { id: 'businessReason', label: 'Business reason', type: 'textarea', required: true },
    ],
  },
  {
    id: 'CAT-LEAVER',
    title: 'Leaver / Account Closure',
    category: 'People',
    description: 'Notify IT of a leaver and arrange access removal, data handling and equipment return.',
    requestType: 'Service Request',
    service: 'Offboarding',
    team: 'Service Desk',
    basePriority: 'Medium',
    approval: 'manager',
    fields: [
      { id: 'leaverName', label: 'Leaver name', type: 'text', required: true },
      { id: 'lastDay', label: 'Last working day', type: 'date', required: true },
      { id: 'disableTime', label: 'Disable access', type: 'select', required: true, options: ['At end of last working day', 'Immediately', 'Specific time in notes'] },
      { id: 'mailboxHandling', label: 'Mailbox handling', type: 'select', required: true, options: ['No delegation', 'Delegate to manager', 'Convert to shared mailbox'] },
      { id: 'notes', label: 'Additional instructions', type: 'textarea', required: false },
    ],
  },
  {
    id: 'CAT-GENERAL',
    title: 'General IT Request',
    category: 'Get help',
    description: 'Use this when none of the other catalogue options fit what you need.',
    requestType: 'Service Request',
    service: 'IT Support',
    team: 'Service Desk',
    basePriority: 'Low',
    approval: 'none',
    fields: [
      { id: 'requestType', label: 'Request type', type: 'select', required: true, options: ['Advice', 'Configuration change', 'Information', 'Other'] },
      { id: 'requiredBy', label: 'Required by', type: 'date', required: false },
    ],
  },
]

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
