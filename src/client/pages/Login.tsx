import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'wouter';

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  const [, setLocation] = useLocation();
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, username, password);
      }
      setLocation('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-poker-gold mb-2">
            Texas Hold'em
          </h1>
          <p className="text-gray-400">
            {isLogin ? 'ログインしてプレイ' : '新規アカウント作成'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-poker-gold"
              required
            />
          </div>
          
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-2">
                ユーザー名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-poker-gold"
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-2">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-poker-gold"
              required
            />
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? '処理中...' : isLogin ? 'ログイン' : '登録'}
          </button>
        </form>
        
        <div className="mt-6 text-center space-y-3">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-poker-gold hover:underline block w-full"
          >
            {isLogin ? 'アカウントを作成' : 'ログインに戻る'}
          </button>
          
          <div className="pt-3 border-t border-gray-700">
            <button
              onClick={() => setLocation('/admin-login')}
              className="text-sm text-gray-400 hover:text-red-400 transition-colors flex items-center justify-center gap-2 w-full"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              管理者ログイン
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
