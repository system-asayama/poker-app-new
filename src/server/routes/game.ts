import express from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { gameManager } from '../game/gameManager.js';
import { query } from '../database/db.js';

const router = express.Router();

// Create game
router.post('/create', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { maxPlayers, isPrivate, invitedEmails, aiPlayers } = req.body;
    
    if (!maxPlayers || maxPlayers < 2 || maxPlayers > 9) {
      return res.status(400).json({ error: 'Max players must be between 2 and 9' });
    }
    
    // Validate AI players
    if (aiPlayers) {
      if (aiPlayers.count < 0 || aiPlayers.count > maxPlayers - 1) {
        return res.status(400).json({ error: 'Invalid AI player count' });
      }
      if (!['easy', 'medium', 'hard'].includes(aiPlayers.difficulty)) {
        return res.status(400).json({ error: 'Invalid AI difficulty' });
      }
    }
    
    const game = await gameManager.createGame(maxPlayers, req.user!.id, isPrivate, invitedEmails, aiPlayers);
    res.json({ game });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Join game
router.post('/:gameId/join', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    // Check if game exists and has space
    const gameResult = await query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = gameResult.rows[0];
    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Game already started' });
    }
    
    // Check if private game and user is invited
    if (game.is_private) {
      const invitedUsers = game.invited_users || [];
      const isInvited = invitedUsers.includes(req.user!.email) || game.host_id === req.user!.id;
      
      if (!isInvited) {
        return res.status(403).json({ error: 'This is a private game. You must be invited to join.' });
      }
    }
    
    const playersResult = await query('SELECT COUNT(*) as count FROM game_players WHERE game_id = $1', [gameId]);
    const playerCount = parseInt(playersResult.rows[0].count);
    
    if (playerCount >= game.max_players) {
      return res.status(400).json({ error: 'Game is full' });
    }
    
    // Check if already joined
    const existingPlayer = await query(
      'SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2',
      [gameId, req.user!.id]
    );
    
    if (existingPlayer.rows.length > 0) {
      return res.status(400).json({ error: 'Already joined this game' });
    }
    
    const player = await gameManager.joinGame(gameId, req.user!.id, playerCount);
    res.json({ player });
  } catch (error) {
    console.error('Join game error:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// Start game
router.post('/:gameId/start', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    await gameManager.startGame(gameId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Start game error:', error);
    res.status(500).json({ error: error.message || 'Failed to start game' });
  }
});

// Perform action
router.post('/:gameId/action', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { action, amount } = req.body;
    
    // Get player ID
    const playerResult = await query(
      'SELECT id FROM game_players WHERE game_id = $1 AND user_id = $2',
      [gameId, req.user!.id]
    );
    
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found in game' });
    }
    
    const playerId = playerResult.rows[0].id;
    await gameManager.performAction(gameId, playerId, action, amount || 0);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Action error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform action' });
  }
});

// Get game state
router.get('/:gameId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    const gameResult = await query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = gameResult.rows[0];
    game.communityCards = JSON.parse(game.community_cards || '[]');
    delete game.deck; // Don't send deck to clients
    
    const playersResult = await query(
      `SELECT gp.*, u.username, u.email 
       FROM game_players gp
       JOIN users u ON gp.user_id = u.id
       WHERE gp.game_id = $1
       ORDER BY gp.position`,
      [gameId]
    );
    
    const players = playersResult.rows.map(p => {
      const player = {
        ...p,
        gameId: p.game_id,
        userId: p.user_id,
        currentBet: p.current_bet,
        holeCards: JSON.parse(p.hole_cards || '[]'),
        isDealer: p.is_dealer,
        user: {
          username: p.username,
          email: p.email,
        },
      };
      
      // Hide other players' hole cards
      if (p.user_id !== req.user!.id) {
        player.holeCards = player.holeCards.map(() => ({ suit: 'hidden', rank: 'hidden' }));
      }
      
      return player;
    });
    
    const actionsResult = await query(
      'SELECT * FROM game_actions WHERE game_id = $1 ORDER BY created_at DESC LIMIT 20',
      [gameId]
    );
    
    const actions = actionsResult.rows.map(a => ({
      ...a,
      gameId: a.game_id,
      playerId: a.player_id,
      createdAt: new Date(a.created_at),
    }));
    
    res.json({ game, players, actions });
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// Get all games
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT g.*, COUNT(gp.id) as player_count
       FROM games g
       LEFT JOIN game_players gp ON g.id = gp.game_id
       WHERE g.status = 'waiting'
       GROUP BY g.id
       ORDER BY g.created_at DESC
       LIMIT 20`
    );
    
    const games = result.rows.map(g => ({
      ...g,
      communityCards: JSON.parse(g.community_cards || '[]'),
      playerCount: parseInt(g.player_count),
    }));
    
    res.json({ games });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to get games' });
  }
});

// Admin: Get full game state with all cards
router.get('/:gameId/admin', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    const gameResult = await query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = gameResult.rows[0];
    game.communityCards = JSON.parse(game.community_cards || '[]');
    game.deck = JSON.parse(game.deck || '[]');
    
    const playersResult = await query(
      `SELECT gp.*, u.username, u.email 
       FROM game_players gp
       JOIN users u ON gp.user_id = u.id
       WHERE gp.game_id = $1
       ORDER BY gp.position`,
      [gameId]
    );
    
    const players = playersResult.rows.map(p => ({
      ...p,
      gameId: p.game_id,
      userId: p.user_id,
      currentBet: p.current_bet,
      holeCards: JSON.parse(p.hole_cards || '[]'),
      isDealer: p.is_dealer,
      user: {
        username: p.username,
        email: p.email,
      },
    }));
    
    const actionsResult = await query(
      'SELECT * FROM game_actions WHERE game_id = $1 ORDER BY created_at DESC',
      [gameId]
    );
    
    const actions = actionsResult.rows.map(a => ({
      ...a,
      gameId: a.game_id,
      playerId: a.player_id,
      createdAt: new Date(a.created_at),
    }));
    
    res.json({ game, players, actions });
  } catch (error) {
    console.error('Get admin game state error:', error);
    res.status(500).json({ error: 'Failed to get admin game state' });
  }
});

export default router;
