import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { socketClient } from '../utils/socket';
import { Card } from '../components/Card';
import { Game as GameType, GamePlayer, GameAction as GameActionType } from '@shared/types';

export function Game() {
  const [, params] = useRoute('/game/:id');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const gameId = parseInt(params?.id || '0');
  
  const [game, setGame] = useState<GameType | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [actions, setActions] = useState<GameActionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [raiseAmount, setRaiseAmount] = useState(0);
  
  useEffect(() => {
    loadGameState();
    
    const socket = socketClient.connect();
    socketClient.joinGame(gameId);
    
    socket.on('game-update', handleGameUpdate);
    
    return () => {
      socketClient.leaveGame(gameId);
      socket.off('game-update', handleGameUpdate);
    };
  }, [gameId]);
  
  function handleGameUpdate() {
    loadGameState();
  }
  
  async function loadGameState() {
    try {
      const data = await api.getGameState(gameId);
      setGame(data.game);
      setPlayers(data.players);
      setActions(data.actions);
    } catch (error) {
      console.error('Failed to load game state:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleStartGame() {
    try {
      await api.startGame(gameId);
      await loadGameState();
    } catch (error: any) {
      alert(error.message || 'Failed to start game');
    }
  }
  
  async function handleAction(action: string, amount?: number) {
    try {
      await api.performAction(gameId, action, amount);
      await loadGameState();
    } catch (error: any) {
      alert(error.message || 'Failed to perform action');
    }
  }
  
  async function handleContinueToNextHand() {
    try {
      await api.continueToNextHand(gameId);
      await loadGameState();
    } catch (error: any) {
      alert(error.message || 'Failed to continue to next hand');
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-400">読み込み中...</div>
      </div>
    );
  }
  
  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-400">ゲームが見つかりません</div>
      </div>
    );
  }
  
  const currentPlayer = players.find(p => p.userId === user?.id);
  const isMyTurn = game.currentTurn === currentPlayer?.id;
  const currentBet = Math.max(...players.map(p => p.currentBet));
  
  // Debug logging
  console.log('[Game] Current turn:', game.currentTurn);
  console.log('[Game] Current player:', currentPlayer);
  console.log('[Game] Is my turn:', isMyTurn);
  console.log('[Game] User:', user);
  console.log('[Game] All players:', players.map(p => ({ id: p.id, userId: p.userId, isAi: p.isAi })));
  
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setLocation('/')}
            className="btn btn-secondary"
          >
            ← 戻る
          </button>
          <div className="text-center">
            <div className="text-xl font-bold text-poker-gold">
              ルームコード: {game.roomCode}
            </div>
            <div className="text-sm text-gray-400">
              フェーズ: {game.currentPhase}
            </div>
            {game.maxHands && (
              <div className="text-sm text-poker-gold mt-1">
                ハンド: {game.currentHand}/{game.maxHands}
              </div>
            )}
            {!game.maxHands && game.currentHand > 1 && (
              <div className="text-sm text-poker-gold mt-1">
                ハンド: {game.currentHand} (無制限)
              </div>
            )}
          </div>
          <div className="w-24"></div>
        </div>
        
        {/* Waiting Room */}
        {game.status === 'waiting' && (
          <div className="bg-gray-800 rounded-2xl p-8 text-center mb-8">
            <h2 className="text-2xl font-bold mb-4">プレイヤー待機中...</h2>
            <div className="text-gray-400 mb-6">
              {players.length}/{game.maxPlayers} プレイヤー
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {players.map((player) => (
                <div key={player.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="font-bold flex items-center justify-center gap-2">
                    {player.isAi && <span className="text-blue-400">🤖</span>}
                    {player.isAi ? player.aiName : player.user?.username}
                  </div>
                  <div className="text-sm text-gray-400">
                    {player.chips.toLocaleString()} チップ
                  </div>
                  {player.isAi && (
                    <div className="text-xs text-blue-400 mt-1">
                      {player.aiDifficulty === 'easy' && '初級'}
                      {player.aiDifficulty === 'medium' && '中級'}
                      {player.aiDifficulty === 'hard' && '上級'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {players.length >= 2 && currentPlayer?.position === 0 && (
              <button onClick={handleStartGame} className="btn btn-primary">
                ゲーム開始
              </button>
            )}
          </div>
        )}
        
        {/* Game Table */}
        {game.status === 'playing' && (
          <div className="relative">
            {/* Poker Table */}
            <div className="poker-table aspect-[16/10] relative mb-8 p-8">
              {/* Community Cards */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-white mb-2">
                    ポット: {game.pot.toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  {game.communityCards.map((card, i) => (
                    <Card key={i} card={card} className="w-16 deal-animation" />
                  ))}
                  {Array.from({ length: 5 - game.communityCards.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-16 aspect-[2.5/3.5] border-2 border-dashed border-white/20 rounded-lg"></div>
                  ))}
                </div>
              </div>
              
              {/* Players */}
              {players.map((player, index) => {
                const angle = (index / players.length) * 2 * Math.PI - Math.PI / 2;
                const radius = 35;
                const x = 50 + radius * Math.cos(angle);
                const y = 50 + radius * Math.sin(angle);
                const isCurrentTurn = game.currentTurn === player.id;
                
                return (
                  <div
                    key={player.id}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                      isCurrentTurn ? 'ring-4 ring-poker-gold rounded-lg' : ''
                    }`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className="bg-gray-800 rounded-lg p-3 min-w-[120px]">
                      <div className="text-sm font-bold text-center mb-1 flex items-center justify-center gap-1">
                        {player.isAi && <span className="text-blue-400">🤖</span>}
                        {player.isAi ? player.aiName : player.user?.username}
                        {player.isDealer && ' 🎯'}
                      </div>
                      <div className="text-xs text-center text-gray-400 mb-2">
                        {player.chips.toLocaleString()} チップ
                      </div>
                      {player.currentBet > 0 && (
                        <div className="text-xs text-center text-poker-gold font-bold mb-2">
                          ベット: {player.currentBet}
                        </div>
                      )}
                      <div className="flex gap-1 justify-center">
                        {player.holeCards.map((card, i) => (
                          <Card
                            key={i}
                            card={card}
                            className="w-10"
                          />
                        ))}
                      </div>
                      {player.status !== 'active' && (
                        <div className="text-xs text-center mt-1 text-red-400">
                          {player.status === 'folded' ? 'フォールド' : 'オールイン'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Action Panel */}
            {currentPlayer && (
              <div className="bg-gray-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="text-sm text-gray-400">あなたのチップ</div>
                    <div className="text-2xl font-bold text-poker-gold">
                      {currentPlayer.chips.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">現在のベット</div>
                    <div className="text-2xl font-bold">
                      {currentBet.toLocaleString()}
                    </div>
                  </div>
                </div>
                
                {currentPlayer.status === 'folded' && (
                  <div className="text-center">
                    <div className="text-red-400 text-lg font-bold mb-2">フォールド済み</div>
                    <div className="text-gray-400">ゲームの進行を観戦しています...</div>
                  </div>
                )}
                
                {isMyTurn && currentPlayer.status === 'active' && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction('fold')}
                        className="btn btn-danger flex-1"
                      >
                        フォールド
                      </button>
                      {currentBet === currentPlayer.currentBet && (
                        <button
                          onClick={() => handleAction('check')}
                          className="btn btn-secondary flex-1"
                        >
                          チェック
                        </button>
                      )}
                      {currentBet > currentPlayer.currentBet && (
                        <button
                          onClick={() => handleAction('call')}
                          className="btn btn-primary flex-1"
                        >
                          コール ({currentBet - currentPlayer.currentBet})
                        </button>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-2">
                        レイズ額: {raiseAmount}
                      </label>
                      <input
                        type="range"
                        min={currentBet + 10}
                        max={currentPlayer.chips}
                        value={raiseAmount}
                        onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
                        className="w-full mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction('raise', raiseAmount)}
                          className="btn btn-primary flex-1"
                          disabled={raiseAmount <= currentBet}
                        >
                          レイズ
                        </button>
                        <button
                          onClick={() => handleAction('allin')}
                          className="btn btn-danger flex-1"
                        >
                          オールイン
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {!isMyTurn && currentPlayer.status === 'active' && (
                  <div className="text-center text-gray-400">
                    他のプレイヤーのターンを待っています...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Game Finished / Showdown */}
        {(game.status === 'finished' || game.currentPhase === 'showdown') && (
          <div className="bg-gray-800 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-poker-gold mb-6 text-center">
              {game.currentPhase === 'showdown' ? 'ショーダウン！' : 'ゲーム終了！'}
            </h2>
            
            {/* Community Cards */}
            {game.communityCards.length > 0 && (
              <div className="mb-8">
                <div className="text-center mb-4">
                  <div className="text-xl font-bold text-white mb-2">
                    コミュニティカード
                  </div>
                  <div className="text-lg text-poker-gold">
                    ポット: {game.pot.toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  {game.communityCards.map((card, i) => (
                    <Card key={i} card={card} className="w-20" />
                  ))}
                </div>
              </div>
            )}
            
            {/* Winner Announcement */}
            {(() => {
              // Determine winners
              let winnerData: { playerIds: number[], handRank?: string, amount?: number } | null = null;
              
              if ((game as any).winners) {
                winnerData = JSON.parse((game as any).winners);
              } else {
                // Fallback: find player(s) with highest chips (gained chips from pot)
                const activePlayers = players.filter(p => p.status === 'active' || p.status === 'allin');
                if (activePlayers.length > 0) {
                  const maxChips = Math.max(...activePlayers.map(p => p.chips));
                  const winners = activePlayers.filter(p => p.chips === maxChips);
                  winnerData = {
                    playerIds: winners.map(w => w.id),
                    amount: game.pot
                  };
                }
              }
              
              if (!winnerData) return null;
              
              const winnerPlayers = players.filter(p => winnerData!.playerIds.includes(p.id));
              const winnerNames = winnerPlayers.map(p => p.isAi ? p.aiName : p.user?.username).join(', ');
              const winnerHandDesc = winnerPlayers[0]?.hand_description || winnerPlayers[0]?.handDescription;
              
              return (
                <div className="bg-gradient-to-r from-poker-gold/20 to-yellow-600/20 border-2 border-poker-gold rounded-lg p-6 mb-6">
                  <div className="text-2xl font-bold text-poker-gold mb-2">
                    🏆 勝者 🏆
                  </div>
                  <div className="text-xl text-white">
                    {winnerNames}
                  </div>
                  {winnerHandDesc && (
                    <div className="text-lg text-gray-300 mt-2">
                      {winnerHandDesc} - {(winnerData.amount || game.pot).toLocaleString()} チップ獲得
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* All Players Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {players.map((player) => {
                // Determine if this player is a winner
                let isWinner = false;
                if ((game as any).winners) {
                  isWinner = JSON.parse((game as any).winners).playerIds.includes(player.id);
                } else {
                  // Fallback: check if player has highest chips among active players
                  const activePlayers = players.filter(p => p.status === 'active' || p.status === 'allin');
                  const maxChips = Math.max(...activePlayers.map(p => p.chips));
                  isWinner = player.chips === maxChips && (player.status === 'active' || player.status === 'allin');
                }
                return (
                  <div
                    key={player.id}
                    className={`rounded-lg p-4 border-2 ${
                      isWinner
                        ? 'bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border-poker-gold'
                        : player.status === 'folded'
                        ? 'bg-gray-700/50 border-gray-600'
                        : 'bg-gray-700 border-gray-600'
                    }`}
                  >
                    <div className="text-center mb-3">
                      <div className="font-bold text-lg flex items-center justify-center gap-2">
                        {isWinner && <span className="text-2xl">🏆</span>}
                        {player.isAi && <span className="text-blue-400">🤖</span>}
                        {player.isAi ? player.aiName : player.user?.username}
                      </div>
                      <div className="text-sm text-gray-400">
                        {player.chips.toLocaleString()} チップ
                      </div>
                      {player.status === 'folded' && (
                        <div className="text-xs text-red-400 mt-1">フォールド</div>
                      )}
                    </div>
                    
                    {/* Player's Hole Cards */}
                    <div className="flex gap-2 justify-center mb-3">
                      {player.holeCards.map((card, i) => (
                        <Card key={i} card={card} className="w-16" />
                      ))}
                    </div>
                    
                    {/* Hand Rank */}
                    {((player as any).hand_description || (player as any).handDescription) && (
                      <div className="text-center text-sm font-bold text-poker-gold">
                        {(player as any).hand_description || (player as any).handDescription}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="text-center space-y-4">
              {/* Debug info */}
              {console.log('Game state:', { phase: game.currentPhase, status: game.status, maxHands: game.maxHands, currentHand: game.currentHand })}
              
              {game.currentPhase === 'showdown' && game.status !== 'finished' && (
                <div>
                  <button
                    onClick={handleContinueToNextHand}
                    className="btn btn-primary text-xl px-8 py-4"
                  >
                    次のハンドへ →
                  </button>
                  <div className="text-sm text-gray-400 mt-2">
                    {game.maxHands ? `ハンド ${game.currentHand}/${game.maxHands} 完了` : `ハンド ${game.currentHand} 完了`}
                  </div>
                </div>
              )}
              {game.status === 'finished' && (
                <button
                  onClick={() => setLocation('/')}
                  className="btn btn-primary"
                >
                  ホームに戻る
                </button>
              )}
              
              {/* Temporary debug button - always show */}
              {game.currentPhase === 'showdown' && game.status === 'finished' && (
                <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded">
                  <div className="text-sm text-red-300 mb-2">
                    Debug: Game is finished but showing continue button
                  </div>
                  <button
                    onClick={handleContinueToNextHand}
                    className="btn btn-secondary text-xl px-8 py-4"
                  >
                    [DEBUG] 次のハンドへ →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
