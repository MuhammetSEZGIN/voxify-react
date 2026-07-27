import api from './api';

function messageFrom(error, fallback) {
  return (
    error.response?.data?.message ||
    error.response?.data?.detail ||
    error.response?.data?.title ||
    error.message ||
    fallback
  );
}

async function request(operation, fallback) {
  try {
    return await operation();
  } catch (error) {
    throw new Error(messageFrom(error, fallback));
  }
}

export async function getNotifications({ page = 1, limit = 20, unreadOnly = false } = {}) {
  const response = await request(
    () => api.get('/notification', { params: { page, limit, unreadOnly } }),
    'Bildirimler alınamadı'
  );
  return {
    items: Array.isArray(response.data?.items) ? response.data.items : [],
    page: response.data?.page ?? page,
    limit: response.data?.limit ?? limit,
    total: response.data?.total ?? 0,
  };
}

export async function getUnreadCount() {
  const response = await request(
    () => api.get('/notification/unread-count'),
    'Okunmamış bildirim sayısı alınamadı'
  );
  return Number(response.data?.count) || 0;
}

export const markAsRead = (notificationId) =>
  request(
    () => api.post(`/notification/${notificationId}/read`),
    'Bildirim okundu olarak işaretlenemedi'
  ).then((response) => response.data);

export const markAllAsRead = () =>
  request(
    () => api.post('/notification/read-all'),
    'Bildirimler okundu olarak işaretlenemedi'
  ).then((response) => response.data);

export const deleteNotification = (notificationId) =>
  request(
    () => api.delete(`/notification/${notificationId}`),
    'Bildirim silinemedi'
  ).then((response) => response.data);

export const clearNotifications = () =>
  request(
    () => api.delete('/notification'),
    'Bildirimler temizlenemedi'
  ).then((response) => response.data);

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearNotifications,
};
