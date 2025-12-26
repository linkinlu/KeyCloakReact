/**
 * Service to interact with Keycloak Admin REST API
 * Documentation: https://www.keycloak.org/docs-api/21.0.1/rest-api/index.html
 */

class KeycloakAdminService {
    constructor(keycloak) {
        this.keycloak = keycloak;
        // Base URL for Admin API: usually {serverUrl}/admin/realms/{realm}
        // We remove the trailing slash if present
        const authServerUrl = keycloak.authServerUrl.replace(/\/$/, "");
        this.baseUrl = `${authServerUrl}/admin/realms/${keycloak.realm}`;
    }

    async _request(endpoint, options = {}) {
        if (!this.keycloak.token) {
            throw new Error("No active token");
        }

        // Ensure token is valid (refresh if needed, with 30s buffer)
        await this.keycloak.updateToken(30);

        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'Authorization': `Bearer ${this.keycloak.token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const config = {
            ...options,
            headers
        };

        const response = await fetch(url, config);

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error("Access Denied: You likely need 'realm-admin' or 'manage-users' role.");
            }
            if (response.status === 409) {
                throw new Error("Conflict: User or resource already exists.");
            }
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${text}`);
        }

        // Return JSON if content exists, otherwise null
        const contentLength = response.headers.get("content-length");
        if (contentLength === '0' || response.status === 204) {
            return null;
        }

        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    /**
   * List users with pagination
   */
    async getUsers(first = 0, max = 10) {
        return this._request(`/users?first=${first}&max=${max}`);
    }

    /**
     * Get total user count (for pagination)
     */
    async getUsersCount() {
        // API: /users/count
        const count = await this._request('/users/count');
        return count ? parseInt(count) : 0;
    }

    /**
     * Get Events (Audit Logs)
     * types: array of strings e.g. ['LOGIN', 'LOGOUT']
     */
    async getEvents(first = 0, max = 10, types = ['LOGIN', 'LOGOUT', 'LOGIN_ERROR']) {
        // API: /events?type=LOGIN&type=LOGOUT...
        const params = new URLSearchParams();
        params.append('first', first);
        params.append('max', max);
        types.forEach(t => params.append('type', t));

        return this._request(`/events?${params.toString()}`);
    }

    /**
     * Create a new user
     */
    async createUser(userData) {
        // userData format: { username: "abc", email: "abc@test.com", enabled: true, ... }
        return this._request('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    /**
     * Set user password
     */
    async resetPassword(userId, newPassword) {
        // API: PUT /users/{id}/reset-password
        const payload = {
            type: "password",
            value: newPassword,
            temporary: false
        };

        return this._request(`/users/${userId}/reset-password`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }

    /**
    * Get all realm roles
    */
    async getRealmRoles() {
        return this._request('/roles');
    }

    /**
     * Get effective realm roles for a specific user
     */
    async getUserRealmRoles(userId) {
        const roles = await this._request(`/users/${userId}/role-mappings/realm`);
        return roles || []; // Returns array of RoleRepresentation
    }

    /**
     * Map roles to user
     * rolesArray: Array of RoleRepresentation objects (must include id and name)
     */
    async addRealmRoleMappings(userId, rolesArray) {
        // POST /users/{id}/role-mappings/realm
        return this._request(`/users/${userId}/role-mappings/realm`, {
            method: 'POST',
            body: JSON.stringify(rolesArray)
        });
    }

    /**
     * Remove roles from user
     * rolesArray: Array of RoleRepresentation objects
     */
    async removeRealmRoleMappings(userId, rolesArray) {
        // DELETE /users/{id}/role-mappings/realm
        return this._request(`/users/${userId}/role-mappings/realm`, {
            method: 'DELETE',
            body: JSON.stringify(rolesArray)
        });
    }

    /**
     * Get specific role by name 
     * Useful to get the Role ID needed for mapping
     */
    async getRoleByName(roleName) {
        return this._request(`/roles/${roleName}`);
    }
}

export default KeycloakAdminService;
