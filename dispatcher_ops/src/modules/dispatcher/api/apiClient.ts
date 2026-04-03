import { useAuthStore } from '../store/authStore';

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().token;

  // Don't set Content-Type for FormData — browser sets it automatically
  // with the correct multipart boundary
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/dispatcher/login';
    throw new Error('Unauthorized');
  }

  return response;
};
