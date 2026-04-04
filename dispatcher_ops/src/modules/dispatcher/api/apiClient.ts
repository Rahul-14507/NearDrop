import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  const token = useAuthStore.getState().token;

  // Don't set Content-Type for FormData — browser sets it automatically
  // with the correct multipart boundary
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(fullUrl, { ...options, headers });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/dispatcher/login';
    throw new Error('Unauthorized');
  }

  return response;
};
