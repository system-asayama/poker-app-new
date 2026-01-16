import { query, getClient } from '../database/db.js';
import { createDeck, shuffleDeck, dealCards } from './deck.js';
import { evaluateHand, compareHands } from './handEvaluator.js';
import { Game, GamePlayer, GamePhase, PlayerAction, Winner, Card } from '@shared/types.js';
import { AIEngine, AIDifficulty } from './aiEngine.js';
import type { Server } from 'socket.io';

export class GameManager {
  private io?: Server;

  setIO(io: Server) {
    this.io = io;
  }
  async createGame(maxPlayers: number, userId: number, isPrivate: boolean = false, invitedEmails: string[] = [], aiPlayers?: { count: number; difficulty: AIDifficulty }): Promise<Game> {
    const roomCode = this.generateRoomCode();
    const deck = shuffleDeck(createDeck());
    
    const result = await query(
      `INSERT INTO games (room_code, max_players, status, current_phase, pot, community_cards, deck, dealer_position, small_blind, big_blind, is_private, host_id, invited_users)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [roomCode, maxPlayers, 'waiting', 'waiting', 0, JSON.stringify([]), JSON.stringify(deck), 0, 10, 20, isPrivate, userId, JSON.stringify(invitedEmails)]
    );
    
    const game = this.mapGame(result.rows[0]);
    
    // Add creator as first player
    await this.joinGame(game.id, userId, 0);
    
    // Add AI players if requested
    if (aiPlayers && aiPlayers.count > 0) {
      for (let i = 0; i < aiPlayers.count; i++) {
        await this.addAIPlayer(game.id, i + 1, aiPlayers.difficulty);
      }
    }
    
    return game;
  }
  
  async joinGame(gameId: number, userId: number, position: number): Promise<GamePlayer> {
    // Get user's chips
    const userResult = await query('SELECT chips FROM users WHERE id = $1', [userId]);
    const userChips = userResult.rows[0].chips;
    
    const result = await query(
      `INSERT INTO game_players (game_id, user_id, position, chips, current_bet, hole_cards, status, is_dealer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [gameId, userId, position, userChips, 0, JSON.stringify([]), 'active', position === 0]
    );
    
    return this.mapGamePlayer(result.rows[0]);
  }
  
  async startGame(gameId: number): Promise<void> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get game and players
      const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
      const game = this.mapGame(gameResult.rows[0]);
      
      const playersResult = await client.query(
        'SELECT * FROM game_players WHERE game_id = $1 ORDER BY position',
        [gameId]
      );
      const players = playersResult.rows.map(this.mapGamePlayer);
      
      console.log('[startGame] Players loaded:', players.map(p => ({ id: p.id, position: p.position, chips: p.chips, currentBet: p.currentBet, isAi: p.isAi })));
      
      if (players.length < 2) {
        throw new Error('At least 2 players required to start');
      }
      
      // Shuffle and deal
      let deck = shuffleDeck(createDeck());
      
      // Deal hole cards to each player and update in a single transaction
      const holeCardsMap = new Map<number, any[]>();
      for (const player of players) {
        const { cards, remainingDeck } = dealCards(deck, 2);
        deck = remainingDeck;
        holeCardsMap.set(player.id, cards);
      }
      
      // Determine blind positions
      const smallBlindPlayer = players[1 % players.length];
      const bigBlindPlayer = players[2 % players.length];
      
      console.log('[startGame] Small blind player:', { id: smallBlindPlayer.id, position: smallBlindPlayer.position, chips: smallBlindPlayer.chips, blind: game.smallBlind });
      console.log('[startGame] Big blind player:', { id: bigBlindPlayer.id, position: bigBlindPlayer.position, chips: bigBlindPlayer.chips, blind: game.bigBlind });
      
      // Update all players in one go: set hole cards and deduct blinds where applicable
      for (const player of players) {
        const holeCards = holeCardsMap.get(player.id)!;
        let newChips = player.chips;
        let newCurrentBet = 0;
        
        if (player.id === smallBlindPlayer.id) {
          newChips = player.chips - game.smallBlind;
          newCurrentBet = game.smallBlind;
          console.log('[startGame] Updating small blind player:', { id: player.id, oldChips: player.chips, newChips, bet: newCurrentBet });
        } else if (player.id === bigBlindPlayer.id) {
          newChips = player.chips - game.bigBlind;
          newCurrentBet = game.bigBlind;
          console.log('[startGame] Updating big blind player:', { id: player.id, oldChips: player.chips, newChips, bet: newCurrentBet });
        } else {
          console.log('[startGame] Updating regular player:', { id: player.id, chips: player.chips });
        }
        
        await client.query(
          'UPDATE game_players SET hole_cards = $1, chips = $2, current_bet = $3 WHERE id = $4',
          [JSON.stringify(holeCards), newChips, newCurrentBet, player.id]
        );
      }
      
      const pot = game.smallBlind + game.bigBlind;
      const currentTurn = (3 % players.length);
      
      // Update game state
      await client.query(
        `UPDATE games SET status = $1, current_phase = $2, deck = $3, pot = $4, current_turn = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        ['playing', 'preflop', JSON.stringify(deck), pot, players[currentTurn].id, gameId]
      );
      
      await client.query('COMMIT');
      
      // Process AI turn if the current player is AI
      const currentPlayer = players[currentTurn];
      if (currentPlayer.isAi) {
        console.log('[startGame] Current player is AI, processing AI turn:', { id: currentPlayer.id, name: currentPlayer.aiName });
        // Process AI turn after a short delay to simulate thinking
        setTimeout(() => {
          this.processAITurn(gameId, currentPlayer.id).catch(err => {
            console.error('[startGame] Error processing AI turn:', err);
          });
        }, 2000);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async performAction(gameId: number, playerId: number, action: PlayerAction, amount: number = 0): Promise<void> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
      const game = this.mapGame(gameResult.rows[0]);
      
      const playerResult = await client.query('SELECT * FROM game_players WHERE id = $1', [playerId]);
      const player = this.mapGamePlayer(playerResult.rows[0]);
      
      if (game.currentTurn !== playerId) {
        throw new Error('Not your turn');
      }
      
      // Process action
      let newPot = game.pot;
      let newPlayerChips = player.chips;
      let newPlayerBet = player.currentBet;
      let newStatus = player.status;
      
      switch (action) {
        case 'fold':
          newStatus = 'folded';
          break;
          
        case 'check':
          // No change
          break;
          
        case 'call':
          const callAmount = await this.getCurrentBet(gameId) - player.currentBet;
          newPlayerChips -= callAmount;
          newPlayerBet += callAmount;
          newPot += callAmount;
          break;
          
        case 'raise':
          const raiseAmount = amount;
          newPlayerChips -= raiseAmount;
          newPlayerBet += raiseAmount;
          newPot += raiseAmount;
          break;
          
        case 'allin':
          newPot += player.chips;
          newPlayerBet += player.chips;
          newPlayerChips = 0;
          newStatus = 'allin';
          break;
      }
      
      // Update player
      await client.query(
        'UPDATE game_players SET chips = $1, current_bet = $2, status = $3 WHERE id = $4',
        [newPlayerChips, newPlayerBet, newStatus, playerId]
      );
      
      // Record action
      await client.query(
        'INSERT INTO game_actions (game_id, player_id, action, amount, phase) VALUES ($1, $2, $3, $4, $5)',
        [gameId, playerId, action, amount, game.currentPhase]
      );
      
      // Update pot
      await client.query('UPDATE games SET pot = $1 WHERE id = $2', [newPot, gameId]);
      
      // Check if only one player remains (all others folded)
      const activePlayers = await client.query(
        "SELECT COUNT(*) as count FROM game_players WHERE game_id = $1 AND status IN ('active', 'allin')",
        [gameId]
      );
      const activeCount = parseInt(activePlayers.rows[0].count);
      
      if (activeCount <= 1) {
        // Game over - award pot to winner
        const winnerResult = await client.query(
          "SELECT id, chips FROM game_players WHERE game_id = $1 AND status IN ('active', 'allin') LIMIT 1",
          [gameId]
        );
        
        if (winnerResult.rows.length > 0) {
          const winner = winnerResult.rows[0];
          await client.query(
            'UPDATE game_players SET chips = chips + $1 WHERE id = $2',
            [newPot, winner.id]
          );
          
          // Record win action
          await client.query(
            'INSERT INTO game_actions (game_id, player_id, action, amount, phase) VALUES ($1, $2, $3, $4, $5)',
            [gameId, winner.id, 'win', newPot, game.currentPhase]
          );
        }
        
        // End game
        await client.query('UPDATE games SET status = $1, pot = 0 WHERE id = $2', ['finished', gameId]);
      } else {
        // Move to next player
        const nextTurn = await this.getNextPlayer(gameId, playerId);
        
        // Check if betting round is complete
        if (await this.isBettingRoundComplete(gameId)) {
          await this.advancePhase(gameId, client);
        } else {
          await client.query('UPDATE games SET current_turn = $1 WHERE id = $2', [nextTurn, gameId]);
        }
        
        await client.query('COMMIT');
        
        // Emit game update via Socket.IO
        if (this.io) {
          this.io.to(`game-${gameId}`).emit('game-update', { gameId });
          console.log(`[Socket.IO] Emitted game-update for game ${gameId}`);
        }
        
        // Trigger AI action if next player is AI
        setTimeout(() => this.processAITurn(gameId, nextTurn), 1500);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private async advancePhase(gameId: number, client: any): Promise<void> {
    const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    const game = this.mapGame(gameResult.rows[0]);
    
    const phaseOrder: GamePhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phaseOrder.indexOf(game.currentPhase);
    
    if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) {
      // Game over
      await this.handleShowdown(gameId, client);
      return;
    }
    
    const nextPhase = phaseOrder[currentIndex + 1];
    let deck = game.deck;
    let communityCards = game.communityCards;
    
    // Deal community cards
    if (nextPhase === 'flop') {
      const { cards, remainingDeck } = dealCards(deck, 3);
      communityCards = [...communityCards, ...cards];
      deck = remainingDeck;
    } else if (nextPhase === 'turn' || nextPhase === 'river') {
      const { cards, remainingDeck } = dealCards(deck, 1);
      communityCards = [...communityCards, cards[0]];
      deck = remainingDeck;
    }
    
    // Reset bets
    await client.query('UPDATE game_players SET current_bet = 0 WHERE game_id = $1', [gameId]);
    
    // Get first active player (including allin players)
    const playersResult = await client.query(
      "SELECT id FROM game_players WHERE game_id = $1 AND status IN ('active', 'allin') ORDER BY position LIMIT 1",
      [gameId]
    );
    
    const nextTurn = playersResult.rows[0]?.id || null;
    
    await client.query(
      'UPDATE games SET current_phase = $1, community_cards = $2, deck = $3, current_turn = $4 WHERE id = $5',
      [nextPhase, JSON.stringify(communityCards), JSON.stringify(deck), nextTurn, gameId]
    );
  }
  
  private async handleShowdown(gameId: number, client: any): Promise<void> {
    const playersResult = await client.query(
      "SELECT * FROM game_players WHERE game_id = $1 AND status IN ('active', 'allin')",
      [gameId]
    );
    
    const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    const game = this.mapGame(gameResult.rows[0]);
    
    const players = playersResult.rows.map(this.mapGamePlayer);
    
    // Evaluate hands
    const hands = players.map((player: GamePlayer) => ({
      player,
      hand: evaluateHand(player.holeCards, game.communityCards),
    }));
    
    // Find winner(s)
    hands.sort((a: any, b: any) => compareHands(b.hand, a.hand));
    const winners = hands.filter((h: any) => h.hand.value === hands[0].hand.value);
    
    // Distribute pot
    const winAmount = Math.floor(game.pot / winners.length);
    
    for (const winner of winners) {
      await client.query(
        'UPDATE game_players SET chips = chips + $1 WHERE id = $2',
        [winAmount, winner.player.id]
      );
    }
    
    await client.query(
      'UPDATE games SET status = $1, current_phase = $2, current_turn = NULL WHERE id = $3',
      ['finished', 'showdown', gameId]
    );
  }
  
  private async getCurrentBet(gameId: number): Promise<number> {
    const result = await query(
      'SELECT MAX(current_bet) as max_bet FROM game_players WHERE game_id = $1',
      [gameId]
    );
    return result.rows[0].max_bet || 0;
  }
  
  private async getNextPlayer(gameId: number, currentPlayerId: number): Promise<number> {
    const result = await query(
      `SELECT id FROM game_players 
       WHERE game_id = $1 AND status = 'active' AND position > (SELECT position FROM game_players WHERE id = $2)
       ORDER BY position LIMIT 1`,
      [gameId, currentPlayerId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    // Wrap around
    const wrapResult = await query(
      `SELECT id FROM game_players WHERE game_id = $1 AND status = 'active' ORDER BY position LIMIT 1`,
      [gameId]
    );
    
    return wrapResult.rows[0].id;
  }
  
  private async isBettingRoundComplete(gameId: number): Promise<boolean> {
    // Get current game phase
    const gameResult = await query('SELECT current_phase FROM games WHERE id = $1', [gameId]);
    const currentPhase = gameResult.rows[0].current_phase;
    
    // Check if all active players have the same bet
    const betResult = await query(
      `SELECT COUNT(*) as active_count, 
              COUNT(DISTINCT current_bet) as distinct_bets
       FROM game_players 
       WHERE game_id = $1 AND status = 'active'`,
      [gameId]
    );
    
    const { active_count, distinct_bets } = betResult.rows[0];
    
    // Check if all active players have acted in this phase
    const actionResult = await query(
      `SELECT COUNT(DISTINCT gp.id) as players_acted
       FROM game_players gp
       LEFT JOIN game_actions ga ON gp.id = ga.player_id AND ga.game_id = $1 AND ga.phase = $2
       WHERE gp.game_id = $1 AND gp.status = 'active' AND ga.id IS NOT NULL`,
      [gameId, currentPhase]
    );
    
    const players_acted = parseInt(actionResult.rows[0].players_acted);
    const active_count_num = parseInt(active_count);
    const distinct_bets_num = parseInt(distinct_bets);
    
    const allPlayersActed = players_acted === active_count_num;
    const allBetsEqual = distinct_bets_num === 1;
    const isComplete = active_count_num > 0 && allBetsEqual && allPlayersActed;
    
    console.log('[isBettingRoundComplete]', { 
      gameId, 
      currentPhase,
      active_count: active_count_num, 
      distinct_bets: distinct_bets_num, 
      players_acted,
      allPlayersActed,
      allBetsEqual,
      isComplete 
    });
    
    return isComplete;
  }
  
  private generateRoomCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  
  private mapGame(row: any): Game {
    return {
      ...row,
      communityCards: Array.isArray(row.community_cards) ? row.community_cards : [],
      deck: Array.isArray(row.deck) ? row.deck : [],
      smallBlind: row.small_blind,
      bigBlind: row.big_blind,
      currentPhase: row.current_phase,
      currentTurn: row.current_turn,
      dealerPosition: row.dealer_position,
      maxPlayers: row.max_players,
      roomCode: row.room_code,
      isPrivate: row.is_private,
      hostId: row.host_id,
      invitedUsers: Array.isArray(row.invited_users) ? row.invited_users : [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
  
  private mapGamePlayer(row: any): GamePlayer {
    return {
      ...row,
      gameId: row.game_id,
      userId: row.user_id,
      currentBet: row.current_bet,
      holeCards: Array.isArray(row.hole_cards) ? row.hole_cards : [],
      isDealer: row.is_dealer,
      isAi: row.is_ai,
      aiDifficulty: row.ai_difficulty,
      aiName: row.ai_name,
    };
  }
  
  async addAIPlayer(gameId: number, position: number, difficulty: AIDifficulty): Promise<GamePlayer> {
    const aiName = AIEngine.generateAIName(difficulty, position - 1);
    const startingChips = 1000;
    
    const result = await query(
      `INSERT INTO game_players (game_id, user_id, position, chips, current_bet, hole_cards, status, is_dealer, is_ai, ai_difficulty, ai_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [gameId, null, position, startingChips, 0, JSON.stringify([]), 'active', false, true, difficulty, aiName]
    );
    
    return this.mapGamePlayer(result.rows[0]);
  }
  
  async processAITurn(gameId: number, playerId: number): Promise<void> {
    try {
      // Check if player is AI
      const playerResult = await query('SELECT * FROM game_players WHERE id = $1', [playerId]);
      if (playerResult.rows.length === 0) return;
      
      const player = this.mapGamePlayer(playerResult.rows[0]);
      if (!player.isAi) return;
      
      // Get game state
      const gameResult = await query('SELECT * FROM games WHERE id = $1', [gameId]);
      if (gameResult.rows.length === 0) return;
      
      const game = this.mapGame(gameResult.rows[0]);
      
      // Check if it's still this player's turn
      if (game.currentTurn !== playerId) return;
      
      // Get current bet
      const currentBet = await this.getCurrentBet(gameId);
      
      // Get active players count
      const playersResult = await query(
        'SELECT COUNT(*) as count FROM game_players WHERE game_id = $1 AND status = $2',
        [gameId, 'active']
      );
      const playersRemaining = parseInt(playersResult.rows[0].count);
      
      // Create AI engine and decide action
      const aiEngine = new AIEngine(player.aiDifficulty as AIDifficulty);
      const gameState = {
        pot: game.pot,
        currentBet: currentBet,
        playerChips: player.chips,
        playerBet: player.currentBet,
        communityCards: game.communityCards,
        holeCards: player.holeCards,
        phase: game.currentPhase,
        playersRemaining: playersRemaining,
      };
      
      const decision = aiEngine.decideAction(gameState);
      
      // Perform the action
      await this.performAction(gameId, playerId, decision.action as PlayerAction, decision.amount);
    } catch (error) {
      console.error('AI turn error:', error);
    }
  }
}

export const gameManager = new GameManager();
