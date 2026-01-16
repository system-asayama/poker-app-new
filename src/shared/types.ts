export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'finished';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';
export type PlayerStatus = 'active' | 'folded' | 'allin' | 'out';

export interface User {
  id: number;
  email: string;
  username: string;
  role: 'player' | 'admin';
  chips: number;
  createdAt: Date;
  loginType?: 'admin' | 'player';
}

export interface Game {
  id: number;
  roomCode: string;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  currentPhase: GamePhase;
  pot: number;
  communityCards: Card[];
  deck: Card[];
  dealerPosition: number;
  currentTurn: number | null;
  smallBlind: number;
  bigBlind: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GamePlayer {
  id: number;
  gameId: number;
  userId: number;
  position: number;
  chips: number;
  currentBet: number;
  holeCards: Card[];
  status: PlayerStatus;
  isDealer: boolean;
  user?: User;
}

export interface GameAction {
  id: number;
  gameId: number;
  playerId: number;
  action: PlayerAction;
  amount: number;
  phase: GamePhase;
  createdAt: Date;
}

export interface GameState {
  game: Game;
  players: GamePlayer[];
  currentPlayer: GamePlayer | null;
  actions: GameAction[];
}

export interface AdminGameState extends GameState {
  allHoleCards: { playerId: number; cards: Card[] }[];
  nextCards: Card[];
}

export type HandRank =
  | 'royal_flush'
  | 'straight_flush'
  | 'four_of_a_kind'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'three_of_a_kind'
  | 'two_pair'
  | 'one_pair'
  | 'high_card';

export interface HandResult {
  rank: HandRank;
  cards: Card[];
  value: number;
}

export interface Winner {
  playerId: number;
  amount: number;
  hand: HandResult;
}
