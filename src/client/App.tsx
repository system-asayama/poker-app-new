import React from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { Admin } from './pages/Admin';
import { AdminLogin } from './pages/AdminLogin';
import { UserManagement } from './pages/UserManagement';

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

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/">
        {() => <PrivateRoute component={Home} />}
      </Route>
      <Route path="/game/:id">
        {(params) => <PrivateRoute component={Game} params={params} />}
      </Route>
      <Route path="/admin">
        {() => <PrivateRoute component={Admin} />}
      </Route>
      <Route path="/users">
        {() => <PrivateRoute component={UserManagement} />}
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
