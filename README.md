# React Keycloak Admin Dashboard

A robust React application demonstrating **direct client-side integration** with Keycloak's Admin REST API. This project serves as a comprehensive example of how to build a User Management and Audit Logging dashboard without a dedicated backend proxy.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![Keycloak](https://img.shields.io/badge/Keycloak-26-orange)

## 🚀 Features

*   **🔐 Seamless Authentication**: Full OIDC integration using `keycloak-js` with Silent SSO check.
*   **👥 User Management**: 
    *   List users with server-side pagination.
    *   Create new users (Username, Email, Credentials).
    *   Edit existing users (Reset Password, Enable/Disable).
*   **🛡️ Dynamic Role Management**: 
    *   Fetch available Realm Roles dynamically.
    *   Assign/Remove specific roles (`admin`, `doctor`, `doctoradmin`).
*   **📜 Audit Logging**: 
    *   View Login, Logout, and Login Error events.
    *   Detailed inspection of user IP and client info.
*   **🎨 Modern UI**: Premium Dark Mode design with responsive glassmorphism elements.

## 🛠️ Tech Stack

*   **Frontend**: React + Vite
*   **Auth**: Keycloak (OIDC)
*   **API**: Keycloak Admin REST API (consumed directly via `fetch`)
*   **Styling**: Pure CSS (Modern Variables & Layouts)

## ⚙️ Prerequisites & Setup

### 1. Keycloak Configuration (Crucial)
To allow the frontend to manage users, your Keycloak Client (`react-app`) must be configured correctly:

*   **Web Origins**: Add `http://localhost:5173` (to allow CORS).
*   **User Permissions**: The logged-in user *must* have the `realm-admin` role (or granular `manage-users` + `view-events` client roles from `realm-management`).
*   **Events**: Enable "Save Events" in Realm Settings to see Audit Logs.

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/your-username/keycloak-react-admin.git

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 3. Environment Config
Update `src/App.jsx` with your Keycloak URL:

```javascript
const keycloakConfig = {
  url: 'http://localhost:8080/', 
  realm: 'my-react-app',
  clientId: 'react-app'
};
```

## 📸 Usage

1.  Login with an Admin account.
2.  Use the **User Management** panel to create users or assign roles.
3.  Scroll down to **Audit Logs** to monitor system access.

## 📄 License
MIT
