import { useState, useEffect, useRef } from 'react';
import Keycloak from 'keycloak-js';
import UserManager from './components/UserManager';
import AuditLog from './components/AuditLog';

// NOTE: You must update this configuration to match your Keycloak server
const keycloakConfig = {
  url: 'http://127.0.0.1:8080/', // URL to your Keycloak server
  realm: 'my-react-app',              // Realm name
  clientId: 'react-app'           // Client ID
};

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [keycloak, setKeycloak] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const isRun = useRef(false);

  const [status, setStatus] = useState('Init...');

  useEffect(() => {
    if (isRun.current) return;
    isRun.current = true;

    const initKeycloak = async () => {
      setStatus('Initializing Keycloak connection...');
      const kc = new Keycloak(keycloakConfig);

      // Safety timeout: If Keycloak doesn't respond in 10 seconds, stop loading
      const timeoutId = setTimeout(() => {
        console.warn("Keycloak init timed out");
        setInitialized(true);
        // We do not set 'authenticated' safely here, but we unblock the UI
      }, 10000);

      try {
        console.log("Starting Keycloak init...");
        const auth = await kc.init({
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
          checkLoginIframe: false, // Try disabling this to see if it fixes the hang
          pkceMethod: 'S256'
        });
        console.log("Keycloak init finished. Auth:", auth);

        clearTimeout(timeoutId);
        setKeycloak(kc);
        setAuthenticated(auth);

        if (auth) {
          setStatus('Loading user profile...');
          const profile = await kc.loadUserProfile();
          setUserInfo(profile);
        }
      } catch (error) {
        console.error("Keycloak initialization failed:", error);
        alert("Keycloak Connection Error: " + (error?.message || "Unknown error. Check console."));
      } finally {
        clearTimeout(timeoutId);
        setInitialized(true);
      }
    };

    initKeycloak();
  }, []);

  if (!initialized) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Loading Keycloak...</h2>
        <p style={{ color: '#94a3b8' }}>{status}</p>
        <p style={{ fontSize: '0.8em', marginTop: '1rem' }}>
          Takes too long? Ensure Keycloak is running at <br />
          <code>{keycloakConfig.url}</code> <br />
          and allows Web Origin: <code>{window.location.origin}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>React + Keycloak</h1>
        {/* User Management Section */}
        <UserManager keycloak={keycloak} />

        {/* Audit Log Section */}
        <AuditLog keycloak={keycloak} />
        {!authenticated ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.1em' }}>
              Secure integration with Keycloak.
              <br />
              <span style={{ fontSize: '0.9em', color: '#94a3b8' }}>
                (Please configure <code>keycloakConfig</code> in App.jsx first)
              </span>
            </p>
            <button onClick={() => keycloak.login()}>
              Login with Keycloak
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.2em' }}>Welcome, <strong>{userInfo?.firstName || userInfo?.username}</strong>!</span>
              <button
                onClick={() => keycloak.logout()}
                style={{ padding: '0.4em 1em', fontSize: '0.9em', background: '#334155' }}
              >
                Logout
              </button>
            </div>

            <div className="user-info">
              <h3 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>User Profile</h3>
              <div className="field-group">
                <label>Username</label>
                <input readOnly value={userInfo?.username || ''} />
              </div>
              <div className="field-group">
                <label>Email</label>
                <input readOnly value={userInfo?.email || ''} />
              </div>
              <div className="field-group">
                <label>Full Name</label>
                <input readOnly value={`${userInfo?.firstName || ''} ${userInfo?.lastName || ''}`} />
              </div>

              <h3 style={{ marginTop: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>Debug Info</h3>
              <label>Raw JSON Data:</label>
              <pre style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px', fontSize: '0.85em', overflowX: 'auto' }}>
                {JSON.stringify(userInfo, null, 2)}
              </pre>

              <label style={{ marginTop: '1rem' }}>Access Token (Truncated):</label>
              <code style={{ display: 'block', wordBreak: 'break-all', fontSize: '0.8rem', color: '#94a3b8' }}>
                {keycloak.token ? keycloak.token.substring(0, 50) + '...' : 'None'}
              </code>
            </div>


          </div>
        )}
      </div>
    </div>
  );
}

export default App;
