import axios from 'axios'

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8082'

export const authClient = axios.create({
  baseURL: AUTH_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor to add token to requests
authClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

authClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Auth API Error:', error.response?.data || error.message)
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
