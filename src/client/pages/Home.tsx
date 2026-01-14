import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'wouter';
import { api } from '../utils/api';

interface Game {
  id: number;
  roomCode: string;
  maxPlayers: number;
  status: string;
  playerCount: number;
  createdAt: string;
}

export function Home() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [games, setGames] = useState<Game[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [invitedEmails, setInvitedEmails] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadGames();
  }, []);
  
  async function loadGames() {
    try {
      const { games } = await api.getGames();
      setGames(games);
    } catch (error) {
      console.error('Failed to load games:', error);
    }
  }
  
  async function handleCreateGame() {
    setLoading(true);
    try {
      const emailList = isPrivate && invitedEmails 
        ? invitedEmails.split(',').map(e => e.trim()).filter(e => e)
        : [];
      
      const { game } = await api.createGame(maxPlayers, isPrivate, emailList);
      setLocation(`/game/${game.id}`);
    } catch (error: any) {
      alert(error.message || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleJoinGame(gameId: number) {
    try {
      await api.joinGame(gameId);
      setLocation(`/game/${gameId}`);
    } catch (error: any) {
      alert(error.message || 'Failed to join game');
    }
  }
  
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-poker-gold mb-2">
              Texas Hold'em Poker
            </h1>
            <p className="text-gray-400">
              ようこそ、{user?.username}さん
            </p>
          </div>
          <div className="flex gap-4">
            {user?.role === 'admin' && (
              <button
                onClick={() => setLocation('/admin')}
                className="btn btn-secondary"
              >
                管理画面
              </button>
            )}
            <button onClick={logout} className="btn btn-secondary">
              ログアウト
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-poker-gold mb-1">
                {user?.chips.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">チップ残高</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-poker-gold mb-1">
                {games.length}
              </div>
              <div className="text-sm text-gray-400">利用可能なゲーム</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-poker-gold mb-1">
                {user?.role === 'admin' ? '管理者' : 'プレイヤー'}
              </div>
              <div className="text-sm text-gray-400">ロール</div>
            </div>
          </div>
        </div>
        
        {/* Create Game Button */}
        <div className="mb-8">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary text-lg px-8 py-4"
          >
            新しいゲームを作成
          </button>
        </div>
        
        {/* Games List */}
        <div>
          <h2 className="text-2xl font-bold mb-4">利用可能なゲーム</h2>
          <div className="grid gap-4">
            {games.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
                現在利用可能なゲームはありません
              </div>
            ) : (
              games.map((game) => (
                <div
                  key={game.id}
                  className="bg-gray-800 rounded-xl p-6 flex justify-between items-center hover:bg-gray-750 transition"
                >
                  <div>
                    <div className="text-xl font-bold text-poker-gold mb-1">
                      ルームコード: {game.roomCode}
                    </div>
                    <div className="text-sm text-gray-400">
                      プレイヤー: {game.playerCount}/{game.maxPlayers}
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinGame(game.id)}
                    className="btn btn-primary"
                    disabled={game.playerCount >= game.maxPlayers}
                  >
                    参加
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">新しいゲームを作成</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                最大プレイヤー数: {maxPlayers}人
              </label>
              <input
                type="range"
                min="2"
                max="9"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>2人</span>
                <span>9人</span>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">プライベートルーム（招待制）</span>
              </label>
            </div>
            
            {isPrivate && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  招待するユーザーのメールアドレス
                </label>
                <textarea
                  value={invitedEmails}
                  onChange={(e) => setInvitedEmails(e.target.value)}
                  placeholder="user1@example.com, user2@example.com"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  カンマ区切りで複数のメールアドレスを入力できます
                </p>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={handleCreateGame}
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading ? '作成中...' : '作成'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary flex-1"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
