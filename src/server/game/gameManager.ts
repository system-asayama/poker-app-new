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
  async createGame(maxPlayers: number, userId: number, isPrivate: boolean = false, invitedEmails: string[] = [], aiPlayers?: { count: number; difficulty: AIDifficulty }, maxHands?: number | null): Promise<Game> {
    const roomCode = this.generateRoomCode();
    const deck = shuffleDeck(createDeck());
    
    const result = await query(
      `INSERT INTO games (room_code, max_players, status, current_phase, pot, community_cards, deck, dealer_position, small_blind, big_blind, is_private, host_id, invited_users, max_hands, current_hand)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [roomCode, maxPlayers, 'waiting', 'waiting', 0, JSON.stringify([]), JSON.stringify(deck), 0, 10, 20, isPrivate, userId, JSON.stringify(invitedEmails), maxHands, 1]
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
        // Call processAITurn without await to avoid blocking
        this.processAITurn(gameId, currentPlayer.id).catch(err => {
          console.error('[startGame] Error processing AI turn:', err);
        });
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
      
      // Prevent actions during showdown or finished game
      if (game.currentPhase === 'showdown' || game.status === 'finished') {
        throw new Error('Game is in showdown or finished, no actions allowed');
      }
      
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
          // Validate: can only check if current bet equals table bet
          const currentBet = await this.getCurrentBet(gameId);
          if (player.currentBet < currentBet) {
            throw new Error('Cannot check, must call or raise');
          }
          break;
          
        case 'call':
          const callAmount = await this.getCurrentBet(gameId) - player.currentBet;
          // If call amount exceeds chips, automatically convert to all-in
          if (callAmount >= player.chips) {
            newPot += player.chips;
            newPlayerBet += player.chips;
            newPlayerChips = 0;
            newStatus = 'allin';
          } else {
            newPlayerChips -= callAmount;
            newPlayerBet += callAmount;
            newPot += callAmount;
            // If chips become 0, mark as all-in
            if (newPlayerChips === 0) {
              newStatus = 'allin';
            }
          }
          break;
          
        case 'raise':
          const raiseAmount = amount;
          const currentTableBet = await this.getCurrentBet(gameId);
          const totalNeeded = raiseAmount - player.currentBet;
          const bigBlind = game.bigBlind || 20;
          
          // Calculate minimum raise amount
          const minRaiseTo = currentTableBet + bigBlind;
          
          // Validate: raise amount must be at least minimum raise
          if (raiseAmount < minRaiseTo) {
            throw new Error(`Raise amount must be at least ${minRaiseTo}`);
          }
          
          // If total needed exceeds chips, convert to all-in
          if (totalNeeded >= player.chips) {
            newPot += player.chips;
            newPlayerBet += player.chips;
            newPlayerChips = 0;
            newStatus = 'allin';
          } else {
            newPlayerChips -= totalNeeded;
            newPlayerBet += totalNeeded;
            newPot += totalNeeded;
            // If chips become 0, mark as all-in
            if (newPlayerChips === 0) {
              newStatus = 'allin';
            }
          }
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
        }
        
        // End game
        await client.query('UPDATE games SET status = $1, pot = 0 WHERE id = $2', ['finished', gameId]);
      } else {
        // Move to next player
        const nextTurn = await this.getNextPlayer(gameId, playerId);
        
        // If no active players (all-in situation), advance to showdown
        if (nextTurn === null) {
          console.log('[performAction] No active players, advancing to showdown');
          // Auto-advance through remaining phases to showdown
          await this.autoAdvanceToShowdown(gameId, client);
          
          await client.query('COMMIT');
          
          // Emit game update via Socket.IO
          if (this.io) {
            this.io.to(`game-${gameId}`).emit('game-update', { gameId });
            console.log(`[Socket.IO] Emitted game-update for game ${gameId}`);
          }
          return;
        }
        
        // Check if betting round is complete
        if (await this.isBettingRoundComplete(gameId)) {
          await this.advancePhase(gameId, client);
          
          // Get the new current turn after phase advance
          const updatedGameResult = await client.query('SELECT current_turn FROM games WHERE id = $1', [gameId]);
          const newCurrentTurn = updatedGameResult.rows[0]?.current_turn;
          
          await client.query('COMMIT');
          
          // Emit game update via Socket.IO
          if (this.io) {
            this.io.to(`game-${gameId}`).emit('game-update', { gameId });
            console.log(`[Socket.IO] Emitted game-update for game ${gameId}`);
          }
          
          // Trigger AI action if new current player is AI
          if (newCurrentTurn) {
            console.log(`[performAction] Triggering AI turn after phase advance for player ${newCurrentTurn}`);
            // Call processAITurn without await to avoid blocking
            this.processAITurn(gameId, newCurrentTurn).catch(err => {
              console.error('[performAction] Error processing AI turn:', err);
            });
          }
        } else {
          await client.query('UPDATE games SET current_turn = $1 WHERE id = $2', [nextTurn, gameId]);
          
          await client.query('COMMIT');
          
          // Emit game update via Socket.IO
          if (this.io) {
            this.io.to(`game-${gameId}`).emit('game-update', { gameId });
            console.log(`[Socket.IO] Emitted game-update for game ${gameId}`);
          }
          
          // Trigger AI action if next player is AI
          console.log(`[performAction] Triggering AI turn for player ${nextTurn}`);
          // Call processAITurn without await to avoid blocking
          this.processAITurn(gameId, nextTurn).catch(err => {
            console.error('[performAction] Error processing AI turn:', err);
          });
        }
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private async autoAdvanceToShowdown(gameId: number, client: any): Promise<void> {
    console.log('[autoAdvanceToShowdown] Starting auto-advance to showdown');
    
    const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    const game = this.mapGame(gameResult.rows[0]);
    
    const phaseOrder: GamePhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phaseOrder.indexOf(game.currentPhase);
    
    let deck = game.deck;
    let communityCards = game.communityCards;
    
    // Auto-deal remaining community cards
    for (let i = currentIndex + 1; i < phaseOrder.length - 1; i++) {
      const phase = phaseOrder[i];
      console.log(`[autoAdvanceToShowdown] Auto-dealing for phase: ${phase}`);
      
      if (phase === 'flop' && communityCards.length === 0) {
        const { cards, remainingDeck } = dealCards(deck, 3);
        communityCards = [...communityCards, ...cards];
        deck = remainingDeck;
      } else if ((phase === 'turn' || phase === 'river') && communityCards.length < 5) {
        const { cards, remainingDeck } = dealCards(deck, 1);
        communityCards = [...communityCards, cards[0]];
        deck = remainingDeck;
      }
    }
    
    // Update game with all community cards
    await client.query(
      'UPDATE games SET community_cards = $1, deck = $2, current_phase = $3, current_turn = NULL WHERE id = $4',
      [JSON.stringify(communityCards), JSON.stringify(deck), 'river', gameId]
    );
    
    // Proceed to showdown
    await this.handleShowdown(gameId, client);
  }
  
  private async advancePhase(gameId: number, client: any): Promise<void> {
    const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    const game = this.mapGame(gameResult.rows[0]);
    
    const phaseOrder: GamePhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentIndex = phaseOrder.indexOf(game.currentPhase);
    
    // If we're at river, go directly to showdown and handle it
    if (game.currentPhase === 'river') {
      await this.handleShowdown(gameId, client);
      return;
    }
    
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
    
    // Get first active player (only status='active', not 'allin')
    const playersResult = await client.query(
      "SELECT id FROM game_players WHERE game_id = $1 AND status = 'active' ORDER BY position LIMIT 1",
      [gameId]
    );
    
    const nextTurn = playersResult.rows[0]?.id || null;
    
    // If no active players (all-in situation), auto-advance to showdown
    if (nextTurn === null) {
      console.log('[advancePhase] No active players, auto-advancing to showdown');
      await client.query(
        'UPDATE games SET current_phase = $1, community_cards = $2, deck = $3, current_turn = NULL WHERE id = $4',
        [nextPhase, JSON.stringify(communityCards), JSON.stringify(deck), gameId]
      );
      // Continue to next phase or showdown
      if (nextPhase === 'river') {
        await this.handleShowdown(gameId, client);
      } else {
        // Recursively advance to next phase
        await this.advancePhase(gameId, client);
      }
      return;
    }
    
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
    
    // Evaluate hands for all players (including folded)
    const allPlayersResult = await client.query(
      'SELECT * FROM game_players WHERE game_id = $1',
      [gameId]
    );
    const allPlayers = allPlayersResult.rows.map(this.mapGamePlayer);
    
    const allHands = allPlayers.map((player: GamePlayer) => ({
      playerId: player.id,
      hand: evaluateHand(player.holeCards, game.communityCards),
      status: player.status,
    }));
    
    // Save hand results for all players
    for (const handResult of allHands) {
      await client.query(
        'UPDATE game_players SET hand_rank = $1, hand_description = $2 WHERE id = $3',
        [handResult.hand.rank, this.getHandDescription(handResult.hand.rank), handResult.playerId]
      );
    }
    
    // Evaluate hands for active players only
    const hands = players.map((player: GamePlayer) => ({
      player,
      hand: evaluateHand(player.holeCards, game.communityCards),
    }));
    
    // Find winner(s) - sort in descending order (highest hand value first)
    hands.sort((a: any, b: any) => b.hand.value - a.hand.value);
    const winners = hands.filter((h: any) => h.hand.value === hands[0].hand.value);
    
    // Distribute pot
    const winAmount = Math.floor(game.pot / winners.length);
    
    for (const winner of winners) {
      await client.query(
        'UPDATE game_players SET chips = chips + $1 WHERE id = $2',
        [winAmount, winner.player.id]
      );
    }
    
    // Save winner information
    const winnerIds = winners.map((w: any) => w.player.id);
    const winnerInfo = {
      playerIds: winnerIds,
      handRank: winners[0].hand.rank,
      amount: winAmount,
    };
    
    await client.query(
      'UPDATE games SET current_phase = $1, current_turn = NULL, winners = $2, pot = 0 WHERE id = $3',
      ['showdown', JSON.stringify(winnerInfo), gameId]
    );
    
    // Check if we should start next hand or end game
    await this.checkAndStartNextHand(gameId, client);
  }
  
  private async checkAndStartNextHand(gameId: number, client: any): Promise<void> {
    // Get game info
    const gameResult = await client.query('SELECT max_hands, current_hand FROM games WHERE id = $1', [gameId]);
    const game = gameResult.rows[0];
    
    // Remove players with 0 chips
    await client.query(
      "UPDATE game_players SET status = 'out' WHERE game_id = $1 AND chips = 0",
      [gameId]
    );
    
    // Check how many players are still in
    const activePlayers = await client.query(
      "SELECT COUNT(*) as count FROM game_players WHERE game_id = $1 AND status != 'out'",
      [gameId]
    );
    
    const playerCount = parseInt(activePlayers.rows[0].count);
    
    // If only 1 player left, end game
    if (playerCount <= 1) {
      await client.query(
        "UPDATE games SET status = 'finished' WHERE id = $1",
        [gameId]
      );
      return;
    }
    
    // Check if we've reached max hands
    if (game.max_hands && game.current_hand >= game.max_hands) {
      await client.query(
        "UPDATE games SET status = 'finished' WHERE id = $1",
        [gameId]
      );
      return;
    }
    
    // Start next hand
    await this.startNextHand(gameId, client);
  }
  
  private async startNextHand(gameId: number, client: any): Promise<void> {
    console.log('[startNextHand] Starting next hand for game', gameId);
    
    // Increment current_hand
    await client.query(
      'UPDATE games SET current_hand = current_hand + 1 WHERE id = $1',
      [gameId]
    );
    
    // Reset all active players
    await client.query(
      "UPDATE game_players SET current_bet = 0, hole_cards = '[]', hand_rank = NULL, hand_description = NULL, status = 'active' WHERE game_id = $1 AND status != 'out'",
      [gameId]
    );
    
    // Move dealer position
    const gameResult = await client.query('SELECT dealer_position FROM games WHERE id = $1', [gameId]);
    const currentDealer = gameResult.rows[0].dealer_position;
    
    const playersResult = await client.query(
      "SELECT * FROM game_players WHERE game_id = $1 AND status != 'out' ORDER BY position",
      [gameId]
    );
    const players = playersResult.rows;
    
    // Find next dealer
    let nextDealerIndex = (currentDealer + 1) % players.length;
    const nextDealer = players[nextDealerIndex].position;
    
    // Create new deck and shuffle
    const shuffledDeck = shuffleDeck(createDeck());
    
    // Deal hole cards
    const holeCards: Record<number, Card[]> = {};
    let deckIndex = 0;
    
    for (let i = 0; i < 2; i++) {
      for (const player of players) {
        if (!holeCards[player.id]) holeCards[player.id] = [];
        holeCards[player.id].push(shuffledDeck[deckIndex++]);
      }
    }
    
    // Update players with hole cards
    for (const player of players) {
      await client.query(
        'UPDATE game_players SET hole_cards = $1 WHERE id = $2',
        [JSON.stringify(holeCards[player.id]), player.id]
      );
    }
    
    // Post blinds
    const smallBlindIndex = (nextDealerIndex + 1) % players.length;
    const bigBlindIndex = (nextDealerIndex + 2) % players.length;
    
    const smallBlindPlayer = players[smallBlindIndex];
    const bigBlindPlayer = players[bigBlindIndex];
    
    const gameInfo = await client.query('SELECT small_blind, big_blind FROM games WHERE id = $1', [gameId]);
    const smallBlind = gameInfo.rows[0].small_blind;
    const bigBlind = gameInfo.rows[0].big_blind;
    
    await client.query(
      'UPDATE game_players SET chips = chips - $1, current_bet = $1 WHERE id = $2',
      [smallBlind, smallBlindPlayer.id]
    );
    
    await client.query(
      'UPDATE game_players SET chips = chips - $1, current_bet = $1 WHERE id = $2',
      [bigBlind, bigBlindPlayer.id]
    );
    
    // First to act is after big blind
    const firstToActIndex = (nextDealerIndex + 3) % players.length;
    const firstToAct = players[firstToActIndex];
    
    // Update game state
    const remainingDeck = shuffledDeck.slice(deckIndex);
    await client.query(
      "UPDATE games SET current_phase = 'preflop', dealer_position = $1, current_turn = $2, community_cards = '[]', deck = $3, pot = $4, winners = NULL WHERE id = $5",
      [nextDealer, firstToAct.id, JSON.stringify(remainingDeck), smallBlind + bigBlind, gameId]
    );
    
    console.log('[startNextHand] Next hand started, first to act:', firstToAct.id);
    
    // Trigger AI if first player is AI
    if (firstToAct.is_ai) {
      this.processAITurn(gameId, firstToAct.id).catch(err => {
        console.error('[startNextHand] AI turn error:', err);
      });
    }
  }
  
  private getHandDescription(rank: string): string {
    const descriptions: Record<string, string> = {
      'high_card': 'ハイカード',
      'one_pair': 'ワンペア',
      'two_pair': 'ツーペア',
      'three_of_a_kind': 'スリーカード',
      'straight': 'ストレート',
      'flush': 'フラッシュ',
      'full_house': 'フルハウス',
      'four_of_a_kind': 'フォーカード',
      'straight_flush': 'ストレートフラッシュ',
      'royal_flush': 'ロイヤルフラッシュ',
    };
    return descriptions[rank] || rank;
  }
  
  private async getCurrentBet(gameId: number): Promise<number> {
    const result = await query(
      'SELECT MAX(current_bet) as max_bet FROM game_players WHERE game_id = $1',
      [gameId]
    );
    return result.rows[0].max_bet || 0;
  }
  
  private async getNextPlayer(gameId: number, currentPlayerId: number): Promise<number | null> {
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
    
    // Return null if no active players (all-in situation)
    return wrapResult.rows.length > 0 ? wrapResult.rows[0].id : null;
  }
  
  private async isBettingRoundComplete(gameId: number): Promise<boolean> {
    // Get current game phase and dealer position
    const gameResult = await query('SELECT current_phase, current_turn, dealer_position FROM games WHERE id = $1', [gameId]);
    const { current_phase: currentPhase, current_turn: currentTurn, dealer_position: dealerPosition } = gameResult.rows[0];
    
    // Get all non-folded players (active or allin)
    const playersResult = await query(
      `SELECT id, current_bet, chips, status FROM game_players 
       WHERE game_id = $1 AND status IN ('active', 'allin')
       ORDER BY position`,
      [gameId]
    );
    
    const allPlayers = playersResult.rows;
    const total_count = allPlayers.length;
    
    if (total_count === 0) {
      return true; // No players left, round is complete
    }
    
    // Get players who can still act (chips > 0 and not allin)
    const actionablePlayers = allPlayers.filter(p => p.status === 'active' && parseInt(p.chips) > 0);
    const actionable_count = actionablePlayers.length;
    
    // If no one can act, round is complete (all-in situation)
    if (actionable_count === 0) {
      console.log('[isBettingRoundComplete] All players all-in or out of chips', {
        gameId,
        currentPhase,
        total_count,
        actionable_count
      });
      return true;
    }
    
    // Check if all actionable players have matching bets
    const actionableBets = actionablePlayers.map(p => parseInt(p.current_bet));
    const allBetsEqual = actionableBets.length === 0 || actionableBets.every(bet => bet === actionableBets[0]);
    
    if (!allBetsEqual) {
      return false; // Not all bets are equal
    }
    
    // Special case for preflop: check if big blind has acted
    if (currentPhase === 'preflop') {
      // Big blind is at position (dealer_position + 2) % player_count
      // First get the player count and dealer position
      const countResult = await query(
        'SELECT COUNT(*) as player_count FROM game_players WHERE game_id = $1',
        [gameId]
      );
      const playerCount = parseInt(countResult.rows[0].player_count);
      const bigBlindPosition = (dealerPosition + 2) % playerCount;
      
      const bigBlindResult = await query(
        'SELECT id FROM game_players WHERE game_id = $1 AND position = $2 LIMIT 1',
        [gameId, bigBlindPosition]
      );
      
      if (bigBlindResult.rows.length > 0) {
        const bigBlindId = bigBlindResult.rows[0].id;
        
        // Check if big blind has acted in this phase
        const bigBlindActionResult = await query(
          `SELECT action FROM game_actions
           WHERE game_id = $1 AND phase = $2 AND player_id = $3
           ORDER BY created_at DESC
           LIMIT 1`,
          [gameId, currentPhase, bigBlindId]
        );
        
        // If big blind has acted and all bets are equal, round is complete
        if (bigBlindActionResult.rows.length > 0 && allBetsEqual) {
          console.log('[isBettingRoundComplete] Preflop - big blind acted', {
            gameId,
            bigBlindId,
            bigBlindAction: bigBlindActionResult.rows[0].action,
            allBetsEqual,
            isComplete: true
          });
          return true;
        }
      }
    }
    
    // Find the last raise action in this phase
    const lastRaiseResult = await query(
      `SELECT player_id, created_at
       FROM game_actions
       WHERE game_id = $1 AND phase = $2 AND action = 'raise'
       ORDER BY created_at DESC
       LIMIT 1`,
      [gameId, currentPhase]
    );
    
    // If there was a raise/bet, check if all actionable players have acted AFTER it
    if (lastRaiseResult.rows.length > 0) {
      const lastRaiseTime = lastRaiseResult.rows[0].created_at;
      const lastRaisePlayerId = lastRaiseResult.rows[0].player_id;
      
      // Check if all actionable players have acted after the last raise
      const actionablePlayerIds = actionablePlayers.map(p => p.id);
      const actionsAfterRaiseResult = await query(
        `SELECT COUNT(DISTINCT player_id) as players_acted_after_raise
         FROM game_actions
         WHERE game_id = $1 AND phase = $2 AND created_at > $3
           AND player_id IN (SELECT id FROM game_players WHERE game_id = $1 AND status = 'active')`,
        [gameId, currentPhase, lastRaiseTime]
      );
      
      const playersActedAfterRaise = parseInt(actionsAfterRaiseResult.rows[0].players_acted_after_raise);
      
      // All actionable players except the raiser must have acted after the raise
      const requiredActions = actionable_count - (actionablePlayerIds.includes(lastRaisePlayerId) ? 1 : 0);
      const isComplete = playersActedAfterRaise >= requiredActions;
      
      console.log('[isBettingRoundComplete] After raise', { 
        gameId, 
        currentPhase,
        total_count,
        actionable_count,
        lastRaisePlayerId,
        playersActedAfterRaise,
        requiredActions,
        allBetsEqual,
        isComplete 
      });
      
      return isComplete;
    }
    
    // No raise/bet in this phase, just check if all actionable players have acted
    const actionablePlayerIds = actionablePlayers.map(p => p.id);
    if (actionablePlayerIds.length === 0) {
      return true; // No one can act
    }
    
    const actionResult = await query(
      `SELECT COUNT(DISTINCT player_id) as players_acted
       FROM game_actions
       WHERE game_id = $1 AND phase = $2
         AND player_id = ANY($3)`,
      [gameId, currentPhase, actionablePlayerIds]
    );
    
    const players_acted = parseInt(actionResult.rows[0].players_acted);
    const allPlayersActed = players_acted === actionable_count;
    const isComplete = allBetsEqual && allPlayersActed;
    
    console.log('[isBettingRoundComplete] No raise', { 
      gameId, 
      currentPhase,
      total_count,
      actionable_count,
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
      console.log(`[processAITurn] Starting for game ${gameId}, player ${playerId}`);
      
      // Check if player is AI
      const playerResult = await query('SELECT * FROM game_players WHERE id = $1', [playerId]);
      if (playerResult.rows.length === 0) {
        console.log(`[processAITurn] Player ${playerId} not found`);
        return;
      }
      
      const player = this.mapGamePlayer(playerResult.rows[0]);
      if (!player.isAi) {
        console.log(`[processAITurn] Player ${playerId} is not AI`);
        return;
      }
      
      console.log(`[processAITurn] Player ${playerId} (${player.aiName}) is AI`);
      
      // Get game state
      const gameResult = await query('SELECT * FROM games WHERE id = $1', [gameId]);
      if (gameResult.rows.length === 0) {
        console.log(`[processAITurn] Game ${gameId} not found`);
        return;
      }
      
      const game = this.mapGame(gameResult.rows[0]);
      console.log(`[processAITurn] Game state: phase=${game.currentPhase}, currentTurn=${game.currentTurn}, status=${game.status}`);
      
      // Check if it's still this player's turn
      if (game.currentTurn !== playerId) {
        console.log(`[processAITurn] Not player's turn. Current turn: ${game.currentTurn}, Player: ${playerId}`);
        return;
      }
      
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
      
      console.log(`[processAITurn] AI deciding action with state:`, gameState);
      const decision = aiEngine.decideAction(gameState);
      console.log(`[processAITurn] AI decided: ${decision.action}, amount: ${decision.amount}`);
      
      // Perform the action with fallback
      try {
        await this.performAction(gameId, playerId, decision.action as PlayerAction, decision.amount);
        console.log(`[processAITurn] Action performed successfully`);
      } catch (actionError: any) {
        console.error('[processAITurn] Error performing action:', actionError.message);
        
        // Fallback: try safe actions
        const callAmount = currentBet - player.currentBet;
        
        try {
          if (callAmount === 0) {
            // No bet to call, just check
            console.log('[processAITurn] Fallback: checking');
            await this.performAction(gameId, playerId, 'check', 0);
          } else if (player.chips >= callAmount) {
            // Can afford to call, do that
            console.log('[processAITurn] Fallback: calling');
            await this.performAction(gameId, playerId, 'call', callAmount);
          } else if (player.chips > 0) {
            // Can't call, go all-in
            console.log('[processAITurn] Fallback: all-in');
            await this.performAction(gameId, playerId, 'allin', player.chips);
          } else {
            // No chips, fold
            console.log('[processAITurn] Fallback: folding');
            await this.performAction(gameId, playerId, 'fold', 0);
          }
          console.log('[processAITurn] Fallback action performed successfully');
        } catch (fallbackError: any) {
          console.error('[processAITurn] Fallback action also failed:', fallbackError.message);
          
          // Last resort: fold
          try {
            console.log('[processAITurn] Last resort: folding');
            await this.performAction(gameId, playerId, 'fold', 0);
          } catch (foldError) {
            console.error('[processAITurn] Even fold failed, game may be stuck');
          }
        }
      }
    } catch (error) {
      console.error('[processAITurn] Outer error:', error);
    }
  }
}

export const gameManager = new GameManager();
