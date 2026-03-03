'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<User | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Add user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('member');

  // Password reset
  const [resetPassword, setResetPassword] = useState('');

  const currentUsername = session?.user?.name?.toLowerCase();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        setError('Admin access required');
        return;
      }
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowAddModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('member');
      setActionSuccess(`User "${data.user.username}" created`);
      fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create user');
    }
  }

  async function handleToggleActive(user: User) {
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionSuccess(`User "${user.username}" ${user.active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user');
    }
  }

  async function handleChangeRole(user: User) {
    setActionError(null);
    const newRole = user.role === 'admin' ? 'member' : 'admin';
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionSuccess(`User "${user.username}" role changed to ${newRole}`);
      fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to change role');
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!showPasswordModal) return;
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/users/${showPasswordModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowPasswordModal(null);
      setResetPassword('');
      setActionSuccess(`Password reset for "${showPasswordModal.username}"`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error === 'Admin access required') {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">You don&apos;t have permission to manage users.</p>
          <Link href="/settings" className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800">
            Back to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-slate-400 hover:text-slate-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1 ml-8">Add, remove, and manage team members</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
        >
          + Add User
        </button>
      </div>

      {/* Status messages */}
      {actionError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
          {actionSuccess}
          <button onClick={() => setActionSuccess(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm">
          {error}. You may need to run the <Link href="/settings/migrate" className="underline">Users migration</Link> first.
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">User</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">Role</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">Created</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const isSelf = user.username === currentUsername;
              return (
                <tr key={user.id} className={isSelf ? 'bg-blue-50/50' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{user.username}</span>
                      {isSelf && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">you</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleChangeRole(user)}
                        disabled={isSelf}
                        className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isSelf ? 'Cannot change own role' : `Change to ${user.role === 'admin' ? 'member' : 'admin'}`}
                      >
                        Toggle Role
                      </button>
                      <button
                        onClick={() => { setShowPasswordModal(user); setResetPassword(''); setActionError(null); }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={isSelf}
                        className={`text-xs disabled:opacity-40 disabled:cursor-not-allowed ${
                          user.active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                        }`}
                        title={isSelf ? 'Cannot deactivate yourself' : undefined}
                      >
                        {user.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-400">
            No users found. Run the <Link href="/settings/migrate" className="text-blue-600 underline">Users migration</Link> to seed users.
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Add User</h2>
            <form onSubmit={handleAddUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              {actionError && (
                <p className="text-sm text-red-600 mt-3">{actionError}</p>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setActionError(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Reset Password for &quot;{showPasswordModal.username}&quot;
            </h2>
            <form onSubmit={handleResetPassword}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  placeholder="Minimum 6 characters"
                />
              </div>
              {actionError && (
                <p className="text-sm text-red-600 mt-3">{actionError}</p>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(null); setActionError(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
