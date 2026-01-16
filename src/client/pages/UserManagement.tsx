import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

interface User {
  id: number;
  email: string;
  username: string;
  role: 'player' | 'admin';
  chips: number;
  created_at: string;
  last_login?: string;
}

export function UserManagement() {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setLocation('/');
      return;
    }
    fetchUsers();
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.users);
    } catch (err: any) {
      setError(err.response?.data?.error || 'ユーザー情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: 'player' | 'admin') => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || '権限の変更に失敗しました');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`${username} を削除してもよろしいですか？この操作は取り消せません。`)) {
      return;
    }

    try {
      await api.delete(`/users/${userId}`);
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'ユーザーの削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-2xl text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-2">
              ユーザー管理
            </h1>
            <p className="text-gray-400">システム管理者専用</p>
          </div>
          <button
            onClick={() => setLocation('/admin')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            ← 監視画面に戻る
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* ユーザーテーブル */}
        <div className="bg-gray-800/50 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">ユーザー名</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">メールアドレス</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">権限</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">チップ</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">登録日</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 text-gray-300">#{user.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{user.username}</span>
                        {user.id === currentUser?.id && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">あなた</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{user.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as 'player' | 'admin')}
                        disabled={user.id === currentUser?.id}
                        className="px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="player">プレイヤー</option>
                        <option value="admin">管理者</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-poker-gold font-semibold">{user.chips.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(user.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        disabled={user.id === currentUser?.id}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 統計情報 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">総ユーザー数</div>
            <div className="text-3xl font-bold text-white">{users.length}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">管理者数</div>
            <div className="text-3xl font-bold text-blue-400">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">プレイヤー数</div>
            <div className="text-3xl font-bold text-green-400">
              {users.filter(u => u.role === 'player').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
