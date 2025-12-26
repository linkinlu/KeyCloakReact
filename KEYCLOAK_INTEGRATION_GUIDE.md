# React + Keycloak Admin Integration Guide

This guide documents the implementation of a client-side Keycloak Admin Dashboard within a React application. It supports User Management (CRUD, Roles) and Audit Logging directly from the frontend using the Keycloak Admin REST API.

## 1. Project Dependencies

Install the official Keycloak adapter:

```bash
npm install keycloak-js
```

## 2. Keycloak Service Layer

Create `src/services/keycloakAdmin.js`. This class wraps the `fetch` API to communicate with Keycloak's Admin endpoints, automatically handling the Bearer token attachment.

**Key Features:**
*   Automatic Token Refresh (`updateToken(30)`).
*   Error Handling (403 Access Denied, 409 Conflict).
*   Endpoints: Users, Roles, Events.

```javascript
/* src/services/keycloakAdmin.js */
class KeycloakAdminService {
  constructor(keycloak) {
    this.keycloak = keycloak;
    // Remove trailing slash from authServerUrl
    const authServerUrl = keycloak.authServerUrl.replace(/\/$/, "");
    this.baseUrl = `${authServerUrl}/admin/realms/${keycloak.realm}`;
  }

  async _request(endpoint, options = {}) {
    if (!this.keycloak.token) throw new Error("No active token");
    await this.keycloak.updateToken(30);

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.keycloak.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        if (response.status === 403) throw new Error("Access Denied: Check permissions.");
        throw new Error(`API Error ${response.status}`);
    }
    
    // Handle 204 No Content
    if (response.status === 204) return null;
    return await response.json();
  }

  /* User Methods */
  async getUsers(first = 0, max = 10) { return this._request(`/users?first=${first}&max=${max}`); }
  async getUsersCount() { const c = await this._request('/users/count'); return parseInt(c); }
  async createUser(user) { return this._request('/users', { method: 'POST', body: JSON.stringify(user) }); }
  async resetPassword(id, pass) { 
      return this._request(`/users/${id}/reset-password`, { 
        method: 'PUT', 
        body: JSON.stringify({ type: "password", value: pass, temporary: false }) 
      }); 
  }
  
  /* Role Methods */
  async getRealmRoles() { return this._request('/roles'); }
  async getUserRealmRoles(id) { return this._request(`/users/${id}/role-mappings/realm`); }
  async addRealmRoleMappings(id, roles) { return this._request(`/users/${id}/role-mappings/realm`, { method: 'POST', body: JSON.stringify(roles) }); }
  async removeRealmRoleMappings(id, roles) { return this._request(`/users/${id}/role-mappings/realm`, { method: 'DELETE', body: JSON.stringify(roles) }); }

  /* Event Methods */
  async getEvents(first = 0, max = 10) { return this._request(`/events?first=${first}&max=${max}`); }
}

export default KeycloakAdminService;
```

## 3. UI Components

### User Management (`UserManager.jsx`)
Features:
*   Lists users with pagination.
*   Shows active/disabled status and assigned roles.
*   **Create User**: Chained calls (Create -> Get ID -> Set Password -> Assign Role).
*   **Edit User**: Update password, Add/Remove roles dynamically.
*   **Role Filtering**: Only shows `admin`, `doctor`, `doctoradmin`.

### Audit Logs (`AuditLog.jsx`)
Features:
*   Lists LOGIN, LOGOUT, LOGIN_ERROR events.
*   Pagination support.
*   Displays IP, Time, Client, and Error Details.

## 4. Keycloak Server Configuration (CRITICAL)

For the frontend to successfully call these APIs, the Keycloak server must be configured effectively:

### A. CORS Configuration
In your Client Settings (`react-app`):
*   **Web Origins**: Must include your app URL (e.g., `http://localhost:5173` or `*`).

### B. User Permissions
The user logged into the React app **MUST** have the following permissions to manage others:

1.  Go to **Users** > Select User > **Role mapping**.
2.  **Assign role** > Filter by client > **realm-management**.
3.  Assign:
    *   `realm-admin` (Grants everything), OR
    *   `manage-users` (Create/Edit users)
    *   `view-users` (List users)
    *   `view-events` (Read Audit Logs)

### C. Enable Audit Logs
1.  Go to **Realm Settings** > **Events**.
2.  Enable **"Save events"**.
3.  (Optional) Configuring expiration to prevent database bloat.

## 5. Usage in App

```javascript
/* App.jsx */
// Only render when authenticated to ensure token exists
{authenticated && (
  <>
    <UserManager keycloak={keycloak} />
    <AuditLog keycloak={keycloak} />
  </>
)}
```
