const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface FetchOptions extends RequestInit {
  body?: any;
}

async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  const { body, ...restOptions } = options;
  
  const config: RequestInit = {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...restOptions.headers,
    },
    credentials: 'include',
  };
  
  if (body) {
    config.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

export const api = {
  // Auth
  register: (email: string, username: string, password: string) =>
    fetchAPI('/auth/register', { method: 'POST', body: { email, username, password } }),
  
  login: (email: string, password: string) =>
    fetchAPI('/auth/login', { method: 'POST', body: { email, password } }),
  
  adminLogin: (email: string, password: string) =>
    fetchAPI('/auth/admin-login', { method: 'POST', body: { email, password } }),
  
  logout: () =>
    fetchAPI('/auth/logout', { method: 'POST' }),
  
  me: () =>
    fetchAPI('/auth/me'),
  
  adminExists: () =>
    fetchAPI('/auth/admin-exists'),
  
  // Games
  getGames: () =>
    fetchAPI('/games'),
  
  createGame: (maxPlayers: number, isPrivate?: boolean, invitedEmails?: string[], aiPlayers?: { count: number; difficulty: string }, maxHands?: number | null) =>
    fetchAPI('/games/create', { method: 'POST', body: { maxPlayers, isPrivate, invitedEmails, aiPlayers, maxHands } }),
  
  joinGame: (gameId: number) =>
    fetchAPI(`/games/${gameId}/join`, { method: 'POST' }),
  
  startGame: (gameId: number) =>
    fetchAPI(`/games/${gameId}/start`, { method: 'POST' }),
  
  getGameState: (gameId: number) =>
    fetchAPI(`/games/${gameId}`),
  
  performAction: (gameId: number, action: string, amount?: number) =>
    fetchAPI(`/games/${gameId}/action`, { method: 'POST', body: { action, amount } }),
  
  // Admin
  getAdminGameState: (gameId: number) =>
    fetchAPI(`/games/${gameId}/admin`),
  
  // Users (Admin only)
  get: (endpoint: string) =>
    fetchAPI(endpoint),
  
  post: (endpoint: string, body: any) =>
    fetchAPI(endpoint, { method: 'POST', body }),
  
  patch: (endpoint: string, body: any) =>
    fetchAPI(endpoint, { method: 'PATCH', body }),
  
  delete: (endpoint: string) =>
    fetchAPI(endpoint, { method: 'DELETE' }),
};
