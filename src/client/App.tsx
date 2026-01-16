import React from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { Admin } from './pages/Admin';
import { AdminLogin } from './pages/AdminLogin';
import { UserManagement } from './pages/UserManagement';
import InitialAdminSetup from './pages/InitialAdminSetup';

function PrivateRoute({ component: Component, ...rest }: any) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-400">読み込み中...</div>
      </div>
    );
  }
  
  return user ? <Component {...rest} /> : <Redirect to="/login" />;
}

function AdminRoute({ component: Component, ...rest }: any) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-400">読み込み中...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  if (user.role !== 'admin' || user.loginType !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl text-red-400 mb-4">アクセス拒否</div>
          <div className="text-gray-400 mb-6">このページは管理者専用です。管理者ログインからアクセスしてください。</div>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-poker-gold text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }
  
  return <Component {...rest} />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/setup-admin">
        {() => <PrivateRoute component={InitialAdminSetup} />}
      </Route>
      <Route path="/">
        {() => <PrivateRoute component={Home} />}
      </Route>
      <Route path="/game/:id">
        {(params) => <PrivateRoute component={Game} params={params} />}
      </Route>
      <Route path="/admin">
        {() => <AdminRoute component={Admin} />}
      </Route>
      <Route path="/users">
        {() => <AdminRoute component={UserManagement} />}
      </Route>
      <Route>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-2xl text-gray-400">404 - ページが見つかりません</div>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
