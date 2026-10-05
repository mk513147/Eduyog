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

export const eduyarpApi = {
  courses: {
    list: () => request('/admin/eduyarp/courses').then((d) => d.courses),
    get: (id) => request(`/admin/eduyarp/courses/${id}`).then((d) => d.course),
    create: (input) =>
      request('/admin/eduyarp/courses', { method: 'POST', body: input }).then((d) => d.course),
    update: (id, changes) =>
      request(`/admin/eduyarp/courses/${id}`, { method: 'PATCH', body: changes }).then((d) => d.course),
    remove: (id) => request(`/admin/eduyarp/courses/${id}`, { method: 'DELETE' }),
    assignTrainer: (courseId, trainerId) =>
      request(`/admin/eduyarp/courses/${courseId}/trainers`, {
        method: 'POST',
        body: { trainerId },
      }).then((d) => d.course),
    unassignTrainer: (courseId, trainerId) =>
      request(`/admin/eduyarp/courses/${courseId}/trainers/${trainerId}`, { method: 'DELETE' }).then(
        (d) => d.course,
      ),
  },
  modules: {
    create: (courseId, input) =>
      request(`/admin/eduyarp/courses/${courseId}/modules`, { method: 'POST', body: input }).then(
        (d) => d.module,
      ),
    update: (id, changes) =>
      request(`/admin/eduyarp/modules/${id}`, { method: 'PATCH', body: changes }).then((d) => d.module),
    remove: (id) => request(`/admin/eduyarp/modules/${id}`, { method: 'DELETE' }),
  },
  topics: {
    create: (moduleId, input) =>
      request(`/admin/eduyarp/modules/${moduleId}/topics`, { method: 'POST', body: input }).then(
        (d) => d.topic,
      ),
    update: (id, changes) =>
      request(`/admin/eduyarp/topics/${id}`, { method: 'PATCH', body: changes }).then((d) => d.topic),
    remove: (id) => request(`/admin/eduyarp/topics/${id}`, { method: 'DELETE' }),
  },
  trainers: {
    list: () => request('/admin/eduyarp/trainers').then((d) => d.trainers),
  },
  enrolments: {
    list: () => request('/admin/eduyarp/enrolments').then((d) => d.enrolments),
    cancel: (id) =>
      request(`/admin/eduyarp/enrolments/${id}`, { method: 'PATCH', body: { status: 'cancelled' } }).then(
        (d) => d.enrolment,
      ),
  },
  classes: {
    list: () => request('/admin/eduyarp/classes').then((d) => d.classes),
    create: (input) =>
      request('/admin/eduyarp/classes', { method: 'POST', body: input }).then((d) => d.class),
    update: (id, changes) =>
      request(`/admin/eduyarp/classes/${id}`, { method: 'PATCH', body: changes }).then((d) => d.class),
    remove: (id) => request(`/admin/eduyarp/classes/${id}`, { method: 'DELETE' }),
  },
}
