import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

const api = axios.create({ baseURL: API_BASE_URL });

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try to refresh, then retry once
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status >= 500) {
      const method = (error.config?.method ?? 'GET').toUpperCase();
      const path = error.config?.url ?? '';
      console.error('[api] server error', {
        method,
        url: `${API_BASE_URL}${path}`,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        await AsyncStorage.setItem('accessToken', data.accessToken);
        await AsyncStorage.setItem('refreshToken', data.refreshToken);

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Refresh failed — clear tokens so the AuthContext can redirect to login
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userProfile']);
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
