import { useState, useEffect } from 'react';
import KeycloakAdminService from '../services/keycloakAdmin';

export default function UserManager({ keycloak }) {
    const [users, setUsers] = useState([]);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
    const [editingUser, setEditingUser] = useState(null);

    // Pagination
    const [page, setPage] = useState(0);
    const [pageSize] = useState(5); // Small page size for demo
    const [totalUsers, setTotalUsers] = useState(0);

    // Form Data
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        selectedRoles: {} // Map of roleName -> boolean
    });

    const adminService = new KeycloakAdminService(keycloak);

    // Initial Data Load
    useEffect(() => {
        loadAllData();
    }, [page]); // Reload when page changes

    const loadAllData = async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([loadRoles(), loadUsers()]);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadRoles = async () => {
        const roles = await adminService.getRealmRoles();
        // Filter roles: only admin, doctor, doctoradmin
        const allowedRoles = ['admin', 'doctor', 'doctoradmin'];
        const filtered = roles.filter(r => allowedRoles.includes(r.name));
        setAvailableRoles(filtered.sort((a, b) => a.name.localeCompare(b.name)));
    };

    const loadUsers = async () => {
        const first = page * pageSize;
        const [data, count] = await Promise.all([
            adminService.getUsers(first, pageSize),
            adminService.getUsersCount() // Note: this might be heavy if called every time, but fine for now
        ]);

        setTotalUsers(count);

        // Fetch roles for each user (Effective roles)
        // Warning: Performance impact on large lists
        const enrichedUsers = await Promise.all(data.map(async (user) => {
            try {
                const userRoles = await adminService.getUserRealmRoles(user.id);
                // Filter roles to exclude standard default ones if we want to reduce noise
                // e.g. 'default-roles-myrealm', 'offline_access', 'uma_authorization'
                const meaningfulRoles = userRoles
                    .map(r => r.name)
                    .filter(n => !['offline_access', 'uma_authorization', 'default-roles-' + keycloak.realm].includes(n));

                return { ...user, realmRoles: meaningfulRoles };
            } catch (e) {
                console.warn(`Failed to fetch roles for user ${user.username}`, e);
                return { ...user, realmRoles: [] };
            }
        }));

        setUsers(enrichedUsers);
    };

    const openCreateModal = () => {
        setModalMode('create');
        setFormData({ username: '', email: '', password: '', selectedRoles: {} });
        setEditingUser(null);
        setShowModal(true);
    }

    const openEditModal = (user) => {
        setModalMode('edit');
        setEditingUser(user);

        // Pre-select current roles
        const roleMap = {};
        user.realmRoles.forEach(r => roleMap[r] = true);

        setFormData({
            username: user.username,
            email: user.email || '',
            password: '', // Blank implies no change
            selectedRoles: roleMap
        });
        setShowModal(true);
    }

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (modalMode === 'create') {
                await performCreate();
            } else {
                await performUpdate();
            }

            setShowModal(false);
            await loadUsers(); // Refresh list to show changes

        } catch (err) {
            setError(`Failed to ${modalMode} user: ` + err.message);
        } finally {
            setLoading(false);
        }
    };

    const performCreate = async () => {
        // 1. Create User
        const newUserData = {
            username: formData.username,
            email: formData.email,
            enabled: true,
            emailVerified: true
        };

        await adminService.createUser(newUserData);

        // 2. Find new user ID
        const usersList = await adminService.getUsers();
        const createdUser = usersList.find(u => u.username === formData.username);
        if (!createdUser) throw new Error("User created but not found.");

        // 3. Set Password
        if (formData.password) {
            await adminService.resetPassword(createdUser.id, formData.password);
        }

        // 4. Assign Roles
        const rolesToAdd = Object.keys(formData.selectedRoles).filter(r => formData.selectedRoles[r]);
        if (rolesToAdd.length > 0) {
            const roleObjects = availableRoles.filter(r => rolesToAdd.includes(r.name));
            await adminService.addRealmRoleMappings(createdUser.id, roleObjects);
        }

        alert(`User ${formData.username} created successfully!`);
    };

    const performUpdate = async () => {
        if (!editingUser) return;

        // 1. Update Password if provided
        if (formData.password) {
            await adminService.resetPassword(editingUser.id, formData.password);
        }

        // 2. Calculate Role Diff
        const currentRoleNames = editingUser.realmRoles || [];
        const newSelectedParams = Object.keys(formData.selectedRoles).filter(r => formData.selectedRoles[r]);

        // Roles to ADD: in new params but not in current
        const toAddNames = newSelectedParams.filter(r => !currentRoleNames.includes(r));

        // Roles to REMOVE: in current but not in new params
        const toRemoveNames = currentRoleNames.filter(r => !newSelectedParams.includes(r));

        if (toAddNames.length > 0) {
            const rolesToAdd = availableRoles.filter(r => toAddNames.includes(r.name));
            await adminService.addRealmRoleMappings(editingUser.id, rolesToAdd);
        }

        if (toRemoveNames.length > 0) {
            // We need the Role objects (with IDs) to remove them. 
            // If availableRoles contains them all, good. 
            // If the user had a role that is somehow not in availableRoles (e.g. system role hidden), we might fail.
            // We'll rely on availableRoles.
            const rolesToRemove = availableRoles.filter(r => toRemoveNames.includes(r.name));
            if (rolesToRemove.length > 0) {
                await adminService.removeRealmRoleMappings(editingUser.id, rolesToRemove);
            }
        }

        alert(`User ${formData.username} updated!`);
    };

    const toggleRole = (roleName) => {
        setFormData(prev => ({
            ...prev,
            selectedRoles: {
                ...prev.selectedRoles,
                [roleName]: !prev.selectedRoles[roleName]
            }
        }));
    };

    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>User Management</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={loadAllData} style={{ backgroundColor: '#3b82f6' }}>
                        ↻ Refresh
                    </button>
                    <button onClick={openCreateModal} style={{ backgroundColor: '#10b981' }}>
                        + Add New User
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {loading && <p>Loading data...</p>}

            {!loading && (
                <div className="user-info" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#1e293b' }}>
                            <tr>
                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Username</th>
                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Email</th>
                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Roles</th>
                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid #334155' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 'bold' }}>{user.username}</div>
                                        <div style={{ fontSize: '0.8em', color: user.enabled ? '#34d399' : '#f87171' }}>
                                            {user.enabled ? 'Active' : 'Disabled'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>{user.email || '-'}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {user.realmRoles && user.realmRoles.length > 0 ? user.realmRoles.map(role => (
                                                <span key={role} style={{
                                                    background: role === 'admin' ? '#7c3aed' : (role === 'doctor' ? '#0ea5e9' : '#475569'),
                                                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.75em'
                                                }}>
                                                    {role}
                                                </span>
                                            )) : <span style={{ color: '#64748b', fontSize: '0.8em' }}>No Roles</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <button
                                            onClick={() => openEditModal(user)}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85em', background: '#334155' }}
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                        No users found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {/* Pagination Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#1e293b', borderTop: '1px solid #334155' }}>
                        <span style={{ fontSize: '0.9em', color: '#94a3b8' }}>
                            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalUsers)} of {totalUsers}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.85em', background: page === 0 ? '#334155' : '#475569', cursor: page === 0 ? 'not-allowed' : 'pointer' }}
                            >
                                Previous
                            </button>
                            <button
                                disabled={(page + 1) * pageSize >= totalUsers}
                                onClick={() => setPage(p => p + 1)}
                                style={{ padding: '0.3rem 0.8rem', fontSize: '0.85em', background: (page + 1) * pageSize >= totalUsers ? '#334155' : '#475569', cursor: (page + 1) * pageSize >= totalUsers ? 'not-allowed' : 'pointer' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="card" style={{ width: '500px', padding: '2rem', background: '#1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3>{modalMode === 'create' ? 'Create New User' : `Edit User: ${formData.username}`}</h3>
                        <form onSubmit={handleSave}>
                            <div className="field-group">
                                <label>Username</label>
                                <input
                                    required
                                    disabled={modalMode === 'edit'}
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    style={{ opacity: modalMode === 'edit' ? 0.6 : 1 }}
                                />
                            </div>
                            <div className="field-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="field-group">
                                <label>
                                    {modalMode === 'edit' ? 'Reset Password (Login to change)' : 'Password'}
                                </label>
                                <input
                                    type="password"
                                    required={modalMode === 'create'}
                                    placeholder={modalMode === 'edit' ? 'Leave blank to keep current' : ''}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <div className="field-group">
                                <label style={{ marginBottom: '0.8rem', display: 'block' }}>Assign Roles</label>
                                <div style={{
                                    background: '#0f172a', padding: '1rem', borderRadius: '6px',
                                    border: '1px solid #334155', maxHeight: '150px', overflowY: 'auto'
                                }}>
                                    {availableRoles.length === 0 ? (
                                        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No roles found</div>
                                    ) : availableRoles
                                        .filter(r => !r.name.startsWith('default-roles-')) // Optional filter
                                        .map(role => (
                                            <div key={role.id} style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    id={`role-${role.id}`}
                                                    checked={!!formData.selectedRoles[role.name]}
                                                    onChange={() => toggleRole(role.name)}
                                                    style={{ width: 'auto', marginRight: '0.8rem', marginBottom: 0 }}
                                                />
                                                <label htmlFor={`role-${role.id}`} style={{ marginBottom: 0, cursor: 'pointer', color: '#e2e8f0' }}>
                                                    {role.name}
                                                </label>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ background: '#475569' }}>
                                    Cancel
                                </button>
                                <button type="submit" style={{ background: '#2563eb' }}>
                                    {modalMode === 'create' ? 'Create User' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Debug Info Footer */}
            <div style={{ marginTop: '2rem', padding: '1rem', borderTop: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>Debug: Current Permissions</h4>
                <p style={{ fontSize: '0.85em', color: '#64748b', wordBreak: 'break-all' }}>
                    <strong>My Roles:</strong> {keycloak.realmAccess?.roles?.join(', ') || 'None'}
                    {!keycloak.realmAccess?.roles?.includes('realm-admin') && (
                        <span style={{ color: '#f59e0b', marginLeft: '1rem' }}>
                            ⚠️ Missing 'realm-admin'
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
}
