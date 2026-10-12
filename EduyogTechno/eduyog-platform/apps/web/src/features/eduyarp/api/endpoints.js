import { request } from './client'

export const authApi = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, token: null }),
  register: (fullName, email, password) =>
    request('/auth/register', { method: 'POST', body: { fullName, email, password }, token: null }),
  me: (token) => request('/auth/me', { token }).then((d) => d.user),
}

export const coursesApi = {
  list: () => request('/eduyarp/courses', { token: null }).then((d) => d.courses),
  get: (slug) =>
    request(`/eduyarp/courses/${encodeURIComponent(slug)}`, { token: null }).then((d) => d.course),
  enrol: (courseId) =>
    request(`/eduyarp/courses/${courseId}/enrol`, { method: 'POST' }).then((d) => d.enrolment),
}

// Always the signed-in student: the backend derives the student from the token.
export const studentApi = {
  courses: () => request('/eduyarp/me/courses').then((d) => d.courses),
  course: (courseId) => request(`/eduyarp/me/courses/${courseId}`).then((d) => d.course),
  schedule: () => request('/eduyarp/me/schedule').then((d) => d.classes),
  completeTopic: (topicId) => request(`/eduyarp/topics/${topicId}/complete`, { method: 'POST' }),
  certificates: () => request('/eduyarp/me/certificates').then((d) => d.certificates),
  certificate: (id) => request(`/eduyarp/me/certificates/${id}`).then((d) => d.certificate),
  assignments: (courseId) => request(`/eduyarp/me/courses/${courseId}/assignments`).then((d) => d.assignments),
  assignment: (id) => request(`/eduyarp/me/assignments/${id}`).then((d) => d.assignment),
  submit: (id, { text, url }) =>
    request(`/eduyarp/me/assignments/${id}/submissions`, { method: 'POST', body: { text, url } }).then((d) => d.submission),
  faqs: (courseId) => request(`/eduyarp/me/courses/${courseId}/faqs`).then((d) => d.faqs),
  resources: (courseId) => request(`/eduyarp/me/courses/${courseId}/resources`).then((d) => d.resources),
}

// The signed-in user's own account (any role). The backend derives the user from the token.
export const profileApi = {
  get: () => request('/me/profile').then((d) => d.profile),
  update: (changes) => request('/me/profile', { method: 'PATCH', body: changes }).then((d) => d.profile),
  // Resolves with { token }: tokens issued before the change stop working, so the
  // caller stores the fresh one to keep the current session going.
  changePassword: (currentPassword, newPassword) =>
    request('/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
}

// Trainer area. Every call is limited by the backend to courses the Trainer is assigned to.
export const trainerApi = {
  courses: () => request('/eduyarp/trainer/courses'),
  schedule: () => request('/eduyarp/trainer/schedule').then((d) => d.classes),
  course: (courseId) => request(`/eduyarp/trainer/courses/${courseId}`).then((d) => d.course),
  students: (courseId) => request(`/eduyarp/trainer/courses/${courseId}/students`).then((d) => d.students),
  student: (courseId, studentId) => request(`/eduyarp/trainer/courses/${courseId}/students/${studentId}`),
  announcements: (courseId) =>
    request(`/eduyarp/trainer/courses/${courseId}/announcements`).then((d) => d.announcements),
  createAnnouncement: (courseId, { title, body }) =>
    request(`/eduyarp/trainer/courses/${courseId}/announcements`, { method: 'POST', body: { title, body } }).then(
      (d) => d.announcement,
    ),
  assignments: (courseId) =>
    request(`/eduyarp/trainer/courses/${courseId}/assignments`).then((d) => d.assignments),
  createAssignment: (courseId, input) =>
    request(`/eduyarp/trainer/courses/${courseId}/assignments`, { method: 'POST', body: input }).then((d) => d.assignment),
  updateAssignment: (id, changes) =>
    request(`/eduyarp/trainer/assignments/${id}`, { method: 'PATCH', body: changes }).then((d) => d.assignment),
  deleteAssignment: (id) => request(`/eduyarp/trainer/assignments/${id}`, { method: 'DELETE' }),
  submissions: (assignmentId) => request(`/eduyarp/trainer/assignments/${assignmentId}/submissions`),
  submission: (id) => request(`/eduyarp/trainer/submissions/${id}`),
  setFeedback: (id, feedback) =>
    request(`/eduyarp/trainer/submissions/${id}/feedback`, { method: 'PUT', body: { feedback } }).then((d) => d.submission),
  faqs: (courseId) => request(`/eduyarp/trainer/courses/${courseId}/faqs`).then((d) => d.faqs),
  resources: (courseId) => request(`/eduyarp/trainer/courses/${courseId}/resources`).then((d) => d.resources),
  createResource: (courseId, input) =>
    request(`/eduyarp/trainer/courses/${courseId}/resources`, { method: 'POST', body: input }).then((d) => d.resource),
  updateResource: (id, changes) =>
    request(`/eduyarp/trainer/resources/${id}`, { method: 'PATCH', body: changes }).then((d) => d.resource),
  deleteResource: (id) => request(`/eduyarp/trainer/resources/${id}`, { method: 'DELETE' }),
  deleteAnnouncement: (id) => request(`/eduyarp/trainer/announcements/${id}`, { method: 'DELETE' }),
}

// The signed-in user's own notifications and announcements (any role).
export const notificationsApi = {
  list: ({ limit = 20, offset = 0, unread = false } = {}) =>
    request(`/me/notifications?limit=${limit}&offset=${offset}${unread ? '&unread=true' : ''}`),
  markRead: (id) => request(`/me/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/me/notifications/read-all', { method: 'POST' }),
  announcements: () => request('/me/announcements').then((d) => d.announcements),
}
