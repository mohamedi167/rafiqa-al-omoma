import api from './client.js';

export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  captcha: () => api.get('/auth/captcha').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  directory: () => api.get('/auth/directory').then((r) => r.data),
};

export const motherApi = {
  profile: () => api.get('/mothers/profile').then((r) => r.data),
  updateProfile: (payload) => api.put('/mothers/profile', payload).then((r) => r.data),
  pregnancyContent: (week) => api.get('/mothers/pregnancy/content', { params: { week } }).then((r) => r.data),
  pregnancyLogs: () => api.get('/mothers/pregnancy/logs').then((r) => r.data),
  addPregnancyLog: (payload) => api.post('/mothers/pregnancy/logs', payload).then((r) => r.data),
  contactDoctor: (message) => api.post('/mothers/contact-doctor', { message }).then((r) => r.data),
  linkUnit: (code) => api.post('/mothers/link-unit', { code }).then((r) => r.data),
  linkDoctor: (code) => api.post('/mothers/link-doctor', { code }).then((r) => r.data),
};

export const childApi = {
  list: () => api.get('/children').then((r) => r.data),
  create: (payload) => api.post('/children', payload).then((r) => r.data),
  detail: (id) => api.get(`/children/${id}`).then((r) => r.data),
};

export const symptomApi = {
  list: () => api.get('/symptoms').then((r) => r.data),
  analyze: (text) => api.post('/symptoms', { text }).then((r) => r.data),
};

export const vaccineApi = {
  schedule: () => api.get('/vaccinations/schedule').then((r) => r.data),
  overview: (childId) => api.get(`/vaccinations/child/${childId}/overview`).then((r) => r.data),
  mark: (childId, groupKey) => api.post(`/vaccinations/child/${childId}/${groupKey}/mark`).then((r) => r.data),
  confirm: (childId, groupKey) => api.post(`/vaccinations/child/${childId}/${groupKey}/confirm`).then((r) => r.data),
  pending: () => api.get('/vaccinations/pending').then((r) => r.data),
};

export const growthApi = {
  list: (childId) => api.get(`/growth/child/${childId}`).then((r) => r.data),
  add: (childId, payload) => api.post(`/growth/child/${childId}`, payload).then((r) => r.data),
};

export const aiApi = {
  analyze: (text) => api.post('/ai/analyze', { text }).then((r) => r.data),
  chat: (message) => api.post('/ai/chat', { message }).then((r) => r.data),
  history: () => api.get('/ai/chat').then((r) => r.data),
};

export const notificationApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  read: (id) => api.post(`/notifications/${id}/read`).then((r) => r.data),
  readAll: () => api.post('/notifications/read-all').then((r) => r.data),
};

export const medicationApi = {
  list: () => api.get('/medications').then((r) => r.data),
  today: (date) => api.get('/medications/today', { params: { date } }).then((r) => r.data),
  create: (payload) => api.post('/medications', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/medications/${id}`, payload).then((r) => r.data),
  toggle: (id) => api.post(`/medications/${id}/toggle`).then((r) => r.data),
  remove: (id) => api.delete(`/medications/${id}`).then((r) => r.data),
  log: (id, payload) => api.post(`/medications/${id}/log`, payload).then((r) => r.data),
};

export const doctorApi = {
  stats: () => api.get('/doctor/stats').then((r) => r.data),
  patients: () => api.get('/doctor/patients').then((r) => r.data),
  patient: (id) => api.get(`/doctor/patients/${id}`).then((r) => r.data),
  profile: () => api.get('/doctor/profile').then((r) => r.data),
  requests: (status = 'pending') => api.get('/doctor/requests', { params: { status } }).then((r) => r.data),
  acceptRequest: (id) => api.post(`/doctor/requests/${id}/accept`).then((r) => r.data),
  rejectRequest: (id) => api.post(`/doctor/requests/${id}/reject`).then((r) => r.data),
};

export const unitApi = {
  stats: () => api.get('/health-units/stats').then((r) => r.data),
  profile: () => api.get('/health-units/profile').then((r) => r.data),
  requests: (status = 'pending') => api.get('/health-units/requests', { params: { status } }).then((r) => r.data),
  acceptRequest: (id) => api.post(`/health-units/requests/${id}/accept`).then((r) => r.data),
  rejectRequest: (id) => api.post(`/health-units/requests/${id}/reject`).then((r) => r.data),
  children: () => api.get('/health-units/children').then((r) => r.data),
  child: (id) => api.get(`/health-units/child/${id}`).then((r) => r.data),
};
