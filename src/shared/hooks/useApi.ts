import { useState } from 'react';
import axios, { AxiosError } from 'axios';
import type { ApiResponse } from '@/shared/lib/types';

export function useApi<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios({
        method,
        url: `/api${url}`,
        data,
      });

      if (response.data.success) {
        return response.data.data as T;
      } else {
        throw new Error(response.data.error || 'Request failed');
      }
    } catch (err) {
      const axiosError = err as AxiosError<ApiResponse<T>>;
      const errorMessage =
        axiosError.response?.data?.error ||
        axiosError.message ||
        'An error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { request, loading, error };
}




