import { useState, useEffect } from 'react';
import KeycloakAdminService from '../services/keycloakAdmin';

export default function AuditLog({ keycloak }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Pagination
    const [page, setPage] = useState(0); // 0-indexed
    const [pageSize] = useState(10);
    // Note: /events endpoint doesn't return total count in header easily usually, 
    // so we might just implement "Next/Prev" without knowing max pages, or just infinite scroll.
    // For simplicity: Next/Prev buttons.

    const adminService = new KeycloakAdminService(keycloak);

    const loadEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            const first = page * pageSize;
            const data = await adminService.getEvents(first, pageSize);
            setEvents(data || []);
        } catch (err) {
            console.error(err);
            // Check for 403 Access Denied
            if (err.message && (err.message.includes("403") || err.message.includes("Access Denied"))) {
                setError(
                    <span>
                        Access Denied. You need <strong>view-events</strong> (or realm-admin) permission.<br />
                        <small>Check Keycloak: Users &gt; [Your User] &gt; Role Mapping &gt; Client Roles (realm-management) &gt; view-events</small>
                    </span>
                );
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEvents();
    }, [page]); // Reload when page changes

    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>Audit Logs (Login/Logout)</h2>
                <button onClick={loadEvents} style={{ backgroundColor: '#3b82f6' }}>
                    ↻ Refresh
                </button>
            </div>

            {error && (
                <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {loading && <p>Loading logs...</p>}

            {!loading && (
                <>
                    <div className="user-info" style={{ padding: 0, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ background: '#1e293b' }}>
                                <tr>
                                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Time</th>
                                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Event</th>
                                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>User / IP</th>
                                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((evt, idx) => (
                                    <tr key={evt.time + '-' + idx} style={{ borderBottom: '1px solid #334155' }}>
                                        <td style={{ padding: '1rem', fontSize: '0.9em', color: '#94a3b8' }}>
                                            {new Date(evt.time).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.85em', fontWeight: 'bold',
                                                color: evt.type === 'LOGIN_ERROR' ? '#f87171' :
                                                    (evt.type === 'LOGIN' ? '#34d399' : '#a78bfa')
                                            }}>
                                                {evt.type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: '500' }}>{
                                                evt.details?.username || (evt.userId ? 'User ID: ' + evt.userId : 'Unknown User')
                                            }</div>
                                            <div style={{ fontSize: '0.8em', color: '#64748b' }}>{evt.ipAddress}</div>
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.85em', color: '#cbd5e1' }}>
                                            Client: {evt.clientId}<br />
                                            {evt.error && <span style={{ color: '#f87171' }}>{evt.error}</span>}
                                        </td>
                                    </tr>
                                ))}
                                {events.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                            No events found. (Ensure "Save Events" is ON in Keycloak)
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Simple Pagination */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            style={{ background: page === 0 ? '#1e293b' : '#334155', cursor: page === 0 ? 'not-allowed' : 'pointer' }}
                        >
                            Previous
                        </button>
                        <span style={{ alignSelf: 'center' }}>Page {page + 1}</span>
                        <button
                            // If we got full page, assume there might be next
                            disabled={events.length < pageSize}
                            onClick={() => setPage(p => p + 1)}
                            style={{ background: events.length < pageSize ? '#1e293b' : '#334155', cursor: events.length < pageSize ? 'not-allowed' : 'pointer' }}
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
