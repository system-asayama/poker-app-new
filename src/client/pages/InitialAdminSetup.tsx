import { useState } from 'react';
import { useNavigate } from 'wouter';
import { api } from '../utils/api';

export default function InitialAdminSetup() {
  const [, navigate] = useNavigate();
  const [masterPassword, setMasterPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/setup-admin', { masterPassword });
      alert('システム管理者として設定されました！');
      navigate('/admin-login');
    } catch (err: any) {
      setError(err.message || '設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-red-900/30">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-900/20 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">初期管理者設定</h1>
          <p className="text-gray-400">マスターパスワードを入力してください</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-6">
          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              マスターパスワード
            </label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              placeholder="マスターパスワードを入力"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '設定中...' : '管理者として設定'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              ← ログインページに戻る
            </button>
          </div>
        </form>

        <div className="mt-8 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
          <p className="text-xs text-yellow-400">
            <strong>注意:</strong> この機能は最初のシステム管理者を設定するためのものです。既に管理者が存在する場合は使用できません。
          </p>
        </div>
      </div>
    </div>
  );
}
