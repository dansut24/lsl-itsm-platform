const API_BASE = window.__HI5_API_BASE__

async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'RMM patching request failed.')
  return payload
}

export function loadRmmPatching() {
  return request('/api/v1/rmm/patching')
}

export function createSoftwareCatalogueEntry(entry) {
  return request('/api/v1/rmm/software-catalogue', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
}
export function updateSoftwareCatalogueEntry(catalogueId, entry) {
  return request('/api/v1/rmm/software-catalogue/' + encodeURIComponent(catalogueId), {
    method: 'PUT',
    body: JSON.stringify(entry),
  })
}

export function deleteSoftwareCatalogueEntry(catalogueId) {
  return request('/api/v1/rmm/software-catalogue/' + encodeURIComponent(catalogueId), {
    method: 'DELETE',
  })
}

export function deploySoftwarePatch(agentDeviceId, catalogueId) {
  return request('/api/v1/rmm/patching/software/deploy', {
    method: 'POST',
    body: JSON.stringify({ agentDeviceId, catalogueId }),
  })
}

export function createPatchPolicy(policy) {
  return request('/api/v1/rmm/patch-policies', {
    method: 'POST',
    body: JSON.stringify(policy),
  })
}

export function createPatchAssignment(assignment) {
  return request('/api/v1/rmm/patch-assignments', {
    method: 'POST',
    body: JSON.stringify(assignment),
  })
}

export function deletePatchAssignment(assignmentId) {
  return request('/api/v1/rmm/patch-assignments/' + encodeURIComponent(assignmentId), {
    method: 'DELETE',
  })
}

export function loadRmmVulnerabilities(limit = 100) {
  return request('/api/v1/rmm/vulnerabilities?limit=' + encodeURIComponent(limit))
}
