import axios from 'axios';

let baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:3000';

// Auto-prefix with https:// if missing to prevent relative path mapping (e.g., in production)
if (baseUrl && !baseUrl.startsWith('http')) {
    baseUrl = `https://${baseUrl}`;
}

const api = axios.create({
    baseURL: baseUrl,
    withCredentials: true
})

export default api;