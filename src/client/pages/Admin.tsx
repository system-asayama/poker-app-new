import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'wouter';
import { api } from '../utils/api';
import { socketClient } from '../utils/socket';
import { Card } from '../components/Card';
import { Game as GameType, GamePlayer, Card as CardType } from '@shared/types';

export function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [gameState, setGameState] = useState<{
    game: GameType;
    players: GamePlayer[];
    actions: any[];
  } | null>(null);
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      setLocation('/');
      return;
    }
    
    loadGames();
    const interval = setInterval(loadGames, 5000);
    return () => clearInterval(interval);
  }, [user]);
  
  useEffect(() => {
    if (selectedGameId) {
      loadGameState(selectedGameId);
      
      const socket = socketClient.connect();
      socketClient.joinGame(selectedGameId);
      
      socket.on('game-update', () => loadGameState(selectedGameId));
      
      return () => {
        socketClient.leaveGame(selectedGameId);
        socket.off('game-update');
      };
    }
  }, [selectedGameId]);
  
  async function loadGames() {
    try {
      const { games } = await api.getGames();
      setGames(games);
    } catch (error) {
      console.error('Failed to load games:', error);
    }
  }
  
  async function loadGameState(gameId: number) {
    try {
      const data = await api.getAdminGameState(gameId);
      setGameState(data);
    } catch (error) {
      console.error('Failed to load game state:', error);
    }
  }
  
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-poker-gold mb-2">
              管理者監視画面
            </h1>
            <p className="text-gray-400">
              全てのゲームとプレイヤーのカードを監視できます
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setLocation('/users')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              ユーザー管理
            </button>
            <button
              onClick={() => setLocation('/')}
              className="btn btn-secondary"
            >
              ホームに戻る
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-8">
          {/* Games List */}
          <div className="col-span-1">
            <h2 className="text-2xl font-bold mb-4">進行中のゲーム</h2>
            <div className="space-y-2">
              {games.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
                  進行中のゲームはありません
                </div>
              ) : (
                games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setSelectedGameId(game.id)}
                    className={`w-full text-left bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition ${
                      selectedGameId === game.id ? 'ring-2 ring-poker-gold' : ''
                    }`}
                  >
                    <div className="font-bold text-poker-gold mb-1">
                      {game.roomCode}
                    </div>
                    <div className="text-sm text-gray-400">
                      {game.status} - {game.playerCount}人
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          
          {/* Game Details */}
          <div className="col-span-2">
            {!gameState ? (
              <div className="bg-gray-800 rounded-2xl p-8 text-center text-gray-400">
                ゲームを選択してください
              </div>
            ) : (
              <div>
                <div className="bg-gray-800 rounded-2xl p-6 mb-6">
                  <h2 className="text-2xl font-bold mb-4">
                    ゲーム情報: {gameState.game.roomCode}
                  </h2>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-400">ステータス</div>
                      <div className="text-lg font-bold text-poker-gold">
                        {gameState.game.status}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">フェーズ</div>
                      <div className="text-lg font-bold">
                        {gameState.game.currentPhase}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">ポット</div>
                      <div className="text-lg font-bold text-poker-gold">
                        {gameState.game.pot.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">プレイヤー</div>
                      <div className="text-lg font-bold">
                        {gameState.players.length}人
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Community Cards */}
                {gameState.game.communityCards.length > 0 && (
                  <div className="bg-gray-800 rounded-2xl p-6 mb-6">
                    <h3 className="text-xl font-bold mb-4">コミュニティカード</h3>
                    <div className="flex gap-2">
                      {gameState.game.communityCards.map((card, i) => (
                        <Card key={i} card={card} className="w-20" />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Deck Preview */}
                {gameState.game.deck && gameState.game.deck.length > 0 && (
                  <div className="bg-gray-800 rounded-2xl p-6 mb-6">
                    <h3 className="text-xl font-bold mb-4">
                      次のカード（デッキトップ5枚）
                    </h3>
                    <div className="flex gap-2">
                      {(gameState.game.deck as CardType[]).slice(0, 5).map((card, i) => (
                        <Card key={i} card={card} className="w-16" />
                      ))}
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                      残り: {gameState.game.deck.length}枚
                    </div>
                  </div>
                )}
                
                {/* All Players' Hole Cards */}
                <div className="bg-gray-800 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-4">
                    全プレイヤーのホールカード
                  </h3>
                  {(() => {
                    // Find current winner(s)
                    const playersWithHands = gameState.players.filter((p: any) => p.currentHand && p.status !== 'folded');
                    const maxValue = playersWithHands.length > 0 ? Math.max(...playersWithHands.map((p: any) => p.currentHand.value)) : 0;
                    const winners = playersWithHands.filter((p: any) => p.currentHand.value === maxValue);
                    const winnerIds = winners.map((w: any) => w.id);
                    
                    return (
                      <div className="space-y-4">
                        {gameState.players.map((player: any) => {
                          const isWinner = winnerIds.includes(player.id);
                          const handRankColors: Record<string, string> = {
                            'royal_flush': 'text-yellow-300',
                            'straight_flush': 'text-yellow-400',
                            'four_of_a_kind': 'text-orange-400',
                            'full_house': 'text-red-400',
                            'flush': 'text-purple-400',
                            'straight': 'text-blue-400',
                            'three_of_a_kind': 'text-green-400',
                            'two_pair': 'text-cyan-400',
                            'one_pair': 'text-gray-300',
                            'high_card': 'text-gray-500',
                          };
                          
                          const handRankNames: Record<string, string> = {
                            'royal_flush': 'ロイヤルフラッシュ',
                            'straight_flush': 'ストレートフラッシュ',
                            'four_of_a_kind': 'フォーカード',
                            'full_house': 'フルハウス',
                            'flush': 'フラッシュ',
                            'straight': 'ストレート',
                            'three_of_a_kind': 'スリーカード',
                            'two_pair': 'ツーペア',
                            'one_pair': 'ワンペア',
                            'high_card': 'ハイカード',
                          };
                          
                          return (
                            <div
                              key={player.id}
                              className={`bg-gray-700 rounded-lg p-4 ${
                                isWinner ? 'ring-4 ring-poker-gold' : ''
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="font-bold text-lg mb-1 flex items-center gap-2">
                                    {isWinner && <span className="text-2xl">🏆</span>}
                                    {player.user?.username}
                                    {player.isDealer && ' 🎯'}
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    チップ: {player.chips.toLocaleString()} | 
                                    ベット: {player.currentBet.toLocaleString()} | 
                                    ステータス: {player.status}
                                  </div>
                                  {player.currentHand && player.status !== 'folded' && (
                                    <div className={`text-sm font-bold mt-2 ${
                                      handRankColors[player.currentHand.rank] || 'text-gray-400'
                                    }`}>
                                      現在の役: {handRankNames[player.currentHand.rank] || player.currentHand.rank}
                                      <span className="text-gray-500 ml-2">
                                        (強さ: {player.currentHand.value})
                                      </span>
                                    </div>
                                  )}
                                  {player.status === 'folded' && (
                                    <div className="text-sm text-red-400 mt-2">
                                      フォールド済み
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {player.holeCards.map((card: any, i: number) => (
                                    <Card key={i} card={card} className="w-16" />
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                
                {/* Recent Actions */}
                {gameState.actions.length > 0 && (
                  <div className="bg-gray-800 rounded-2xl p-6 mt-6">
                    <h3 className="text-xl font-bold mb-4">アクション履歴</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {gameState.actions.map((action, i) => {
                        const player = gameState.players.find(p => p.id === action.playerId);
                        return (
                          <div
                            key={i}
                            className="bg-gray-700 rounded p-3 text-sm"
                          >
                            <span className="font-bold text-poker-gold">
                              {player?.user?.username}
                            </span>
                            {' '}
                            <span className="text-gray-300">{action.action}</span>
                            {action.amount > 0 && (
                              <span className="text-gray-300">
                                {' '}({action.amount.toLocaleString()})
                              </span>
                            )}
                            <span className="text-gray-500 ml-2">
                              - {action.phase}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
