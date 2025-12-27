import NetInfo from '@react-native-community/netinfo';
import { config } from '../config/env';

/**
 * API Adapter for React Native
 * Converts axios-style calls to fetch API with network detection
 */
class APIAdapter {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    /**
     * Check network connectivity
     */
    async checkNetwork() {
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
            throw {
                message: 'No internet connection',
                code: 'NO_INTERNET',
                isNetworkError: true
            };
        }
    }

    /**
     * Make HTTP request
     */
    async request(endpoint, options = {}) {
        // Network check
        await this.checkNetwork();

        const url = `${this.baseURL}${endpoint}`;
        const fetchConfig = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (options.data) {
            fetchConfig.body = JSON.stringify(options.data);
        }

        try {
            if (config.ENABLE_DEVTOOLS) {
                console.log(`[API] ${fetchConfig.method} ${url}`);
            }

            const response = await fetch(url, fetchConfig);

            if (!response.ok) {
                let error;
                try {
                    error = await response.json();
                } catch {
                    error = { message: 'Request failed' };
                }

                throw {
                    message: error.message || error.error || 'API Error',
                    status: response.status,
                    data: error
                };
            }

            const data = await response.json();

            if (config.ENABLE_DEVTOOLS) {
                console.log(`[API] Response:`, data);
            }

            return data;
        } catch (error) {
            if (error.isNetworkError) throw error;

            console.error('[API] Error:', error);

            throw {
                message: error.message || 'Request failed',
                status: error.status || 500,
                isNetworkError: false,
                originalError: error
            };
        }
    }

    /**
     * Axios-like methods for compatibility
     */
    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    post(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', data });
    }

    put(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', data });
    }

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    patch(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'PATCH', data });
    }
}

// Export singleton instance
export default new APIAdapter(config.API_URL);
