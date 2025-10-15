const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

console.log('🔗 API Base URL:', API_BASE_URL); // Debug log

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      console.log(`📡 API Request: ${options.method || 'GET'} ${url}`); // Debug log
      
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          message: `HTTP error! status: ${response.status}` 
        }));
        throw new Error(error.message || error.error || 'Request failed');
      }
      
      const data = await response.json();
      console.log('✅ API Response:', data); // Debug log
      return data;
    } catch (error) {
      console.error('❌ API Request Error:', error);
      throw error;
    }
  }

  // Auth methods
  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'GET'
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me', {
      method: 'GET'
    });
  }

  // ML prediction
  async predictHealth(data) {
    return this.request('/ml/predict', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Service locator
  async findServices(latitude, longitude, equipmentType, radius = 5000) {
    const params = new URLSearchParams({
      lat: latitude,
      lng: longitude,
      type: equipmentType,
      radius: radius
    });
    return this.request(`/service-locator?${params}`, {
      method: 'GET'
    });
  }
}

export default new ApiService();