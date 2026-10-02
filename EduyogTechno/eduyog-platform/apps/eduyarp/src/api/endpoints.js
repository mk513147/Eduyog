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
}
