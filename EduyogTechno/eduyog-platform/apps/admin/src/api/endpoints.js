import { request } from './client'

// One function per existing backend endpoint. Each resolves to the unwrapped
// payload (e.g. the platforms array) so pages do not depend on envelope keys.

export const authApi = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, token: null }),
  me: (token) => request('/auth/me', { token }).then((d) => d.user),
}

export const platformsApi = {
  list: () => request('/admin/platforms').then((d) => d.platforms),
  create: (input) =>
    request('/admin/platforms', { method: 'POST', body: input }).then((d) => d.platform),
  update: (id, changes) =>
    request(`/admin/platforms/${id}`, { method: 'PATCH', body: changes }).then((d) => d.platform),
  remove: (id) => request(`/admin/platforms/${id}`, { method: 'DELETE' }),
}

export const servicesApi = {
  list: () => request('/admin/services').then((d) => d.services),
  create: (input) =>
    request('/admin/services', { method: 'POST', body: input }).then((d) => d.service),
  update: (id, changes) =>
    request(`/admin/services/${id}`, { method: 'PATCH', body: changes }).then((d) => d.service),
  remove: (id) => request(`/admin/services/${id}`, { method: 'DELETE' }),
}

export const usersApi = {
  list: () => request('/admin/users').then((d) => d.users),
  changeRole: (id, role) =>
    request(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }).then((d) => d.user),
}

export const leadsApi = {
  list: () => request('/admin/fitness-leads').then((d) => d.leads),
  get: (id) => request(`/admin/fitness-leads/${id}`).then((d) => d.lead),
}
