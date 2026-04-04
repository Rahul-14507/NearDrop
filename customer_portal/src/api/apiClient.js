const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiFetch = async (url, options = {}) => {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(fullUrl, { ...options, headers });
  return response;
};
