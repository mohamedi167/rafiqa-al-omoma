import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rafiqa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rafiqa_token');
      localStorage.removeItem('rafiqa_user');
      window.dispatchEvent(new Event('rafiqa:unauthorized'));
    }
    return Promise.reject(err);
  },
);

export const apiError = (err) =>
  err?.response?.data?.error || err?.message || 'حدث خطأ غير متوقع، حاولي مرة أخرى';

export default api;
