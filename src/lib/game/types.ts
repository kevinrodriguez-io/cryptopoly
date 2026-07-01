// ============================================
// CRYPTOPOLY - Game Types
// ============================================

// Player token types (crypto-themed icons)
export type TokenType =
  | 'bitcoin'
  | 'ethereum'
  | 'solana'
  | 'dogecoin'
  | 'cardano'
  | 'polkadot';

export const TOKEN_COLORS: Record<TokenType, string> = {
  bitcoin: '#f7931a',
  ethereum: '#627eea',
  solana: '#00ffa3',
  dogecoin: '#c2a633',
  cardano: '#0033ad',
  polkadot: '#e6007a',
};

export const TOKEN_NAMES: Record<TokenType, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  solana: 'Solana',
  dogecoin: 'Dogecoin',
  cardano: 'Cardano',
  polkadot: 'Polkadot',
};

/** Paths to token logo images (CoinGecko assets in public/assets/tokens). Run `pnpm download-token-images` to fetch. */
export const TOKEN_IMAGES: Record<TokenType, string> = {
  bitcoin: '/assets/tokens/bitcoin.png',
  ethereum: '/assets/tokens/ethereum.png',
  solana: '/assets/tokens/solana.png',
  dogecoin: '/assets/tokens/dogecoin.png',
  cardano: '/assets/tokens/cardano.png',
  polkadot: '/assets/tokens/polkadot.jpg',
};

// Property color groups
export type PropertyGroup =
  | 'meme'      // Brown - cheap meme coins
  | 'layer2'    // Light blue - L2 solutions
  | 'defi'      // Pink - DeFi protocols
  | 'smart'     // Orange - Smart contract platforms
  | 'oracle'    // Red - Oracles & infrastructure
  | 'rising'    // Yellow - Rising stars
  | 'layer1'    // Green - Layer 1 giants
  | 'elite'     // Dark blue - Top tier (BTC, ETH)
  | 'railroad'  // Exchanges
  | 'utility';  // Mining/Staking

export const GROUP_COLORS: Record<PropertyGroup, string> = {
  meme: '#8b4513',
  layer2: '#87ceeb',
  defi: '#ff69b4',
  smart: '#ffa500',
  oracle: '#dc143c',
  rising: '#ffd700',
  layer1: '#228b22',
  elite: '#0000cd',
  railroad: '#2f2f2f',
  utility: '#808080',
};

export const GROUP_NAMES: Record<PropertyGroup, string> = {
  meme: 'Meme Coins',
  layer2: 'Layer 2',
  defi: 'DeFi',
  smart: 'Smart Contracts',
  oracle: 'Infrastructure',
  rising: 'Rising Stars',
  layer1: 'Layer 1',
  elite: 'Elite',
  railroad: 'Exchanges',
  utility: 'Mining & Staking',
};

// Tile types
export type TileType =
  | 'property'
  | 'railroad'
  | 'utility'
  | 'chance'
  | 'community-chest'
  | 'tax'
  | 'go'
  | 'jail'
  | 'free-parking'
  | 'go-to-jail';

// Base tile interface
export interface BaseTile {
  index: number;
  type: TileType;
  name: string;
}

// Property tile
export interface PropertyTile extends BaseTile {
  type: 'property';
  group: PropertyGroup;
  price: number;
  rent: number[];  // [base, 1 house, 2 houses, 3 houses, 4 houses, hotel]
  houseCost: number;
  hotelCost: number;
  mortgage: number;
}

// Railroad tile
export interface RailroadTile extends BaseTile {
  type: 'railroad';
  price: number;
  rent: number[];  // [1 owned, 2 owned, 3 owned, 4 owned]
  mortgage: number;
}

// Utility tile
export interface UtilityTile extends BaseTile {
  type: 'utility';
  price: number;
  mortgage: number;
}

// Tax tile
export interface TaxTile extends BaseTile {
  type: 'tax';
  amount: number;
}

// Special tiles
export interface SpecialTile extends BaseTile {
  type: 'go' | 'jail' | 'free-parking' | 'go-to-jail';
}

// Card tiles
export interface CardTile extends BaseTile {
  type: 'chance' | 'community-chest';
}

// Union type for all tiles
export type Tile = PropertyTile | RailroadTile | UtilityTile | TaxTile | SpecialTile | CardTile;

// Card types
export interface Card {
  id: string;
  type: 'chance' | 'community-chest';
  title: string;
  description: string;
  action: CardAction;
}

export type CardAction =
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'pay-each-player'; amount: number }
  | { type: 'collect-from-each'; amount: number }
  | { type: 'move-to'; tileIndex: number; collectGo?: boolean }
  | { type: 'move-back'; spaces: number }
  | { type: 'go-to-jail' }
  | { type: 'get-out-of-jail-free' }
  | { type: 'repairs'; perHouse: number; perHotel: number }
  | { type: 'advance-to-nearest'; tileType: 'railroad' | 'utility'; payMultiple?: number };

// Property ownership state
export interface PropertyState {
  ownerId: string | null;
  houses: number;  // 0-4 houses, 5 = hotel
  isMortgaged: boolean;
}

// Player state
export interface Player {
  id: string;
  name: string;
  token: TokenType;
  position: number;
  money: number;
  properties: number[];  // tile indices
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
  isConnected: boolean;
  hasRolled: boolean;
}

// Pending action types
export type PendingAction =
  | { type: 'buy-decision'; tileIndex: number; price: number }
  | { type: 'auction'; tileIndex: number; currentBid: number; currentBidderId: string | null; participants: string[] }
  | { type: 'pay-rent'; amount: number; toPlayerId: string }
  | { type: 'pay-tax'; amount: number }
  | { type: 'draw-card'; cardType: 'chance' | 'community-chest' }
  | { type: 'card-action'; card: Card }
  | { type: 'jail-decision' }  // pay, roll, or use card
  | { type: 'bankruptcy'; creditorId: string | null };  // null = bank

// Trade offer
export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredProperties: number[];
  offeredMoney: number;
  requestedProperties: number[];
  requestedMoney: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

// Game phase
export type GamePhase =
  | 'lobby'           // Waiting for players
  | 'icon-selection'  // Players choosing tokens
  | 'turn-order'      // Rolling to determine order
  | 'playing'         // Main game
  | 'finished';       // Game over

// Game state
export interface GameState {
  // Meta
  roomId: string;
  hostId: string;
  phase: GamePhase;

  // Turn management
  turnOrder: string[];  // Player IDs in turn order
  currentPlayerIndex: number;
  turnPhase: 'pre-roll' | 'post-roll' | 'action' | 'end-turn';

  // Dice
  currentDiceRoll: [number, number] | null;
  /** Incremented on each ROLL_DICE so clients can trigger dice animation exactly once per roll */
  lastDiceRollId: number;
  /** Seed for deterministic dice physics – same on all clients for same roll */
  lastDiceRollSeed?: number;
  doublesCount: number;

  // Players
  players: Record<string, Player>;

  // Properties
  properties: Record<number, PropertyState>;  // tileIndex -> state

  // Cards
  chanceCards: Card[];
  communityChestCards: Card[];
  drawnCard: Card | null;

  // Special
  freeParking: number;

  // Pending actions
  pendingAction: PendingAction | null;

  // Trade
  tradeOffers: TradeOffer[];

  // Winner
  winnerId: string | null;

  /**
   * Set whenever a player collects the GO salary (passing or landing on GO).
   * `id` increments on each collection so clients can trigger the
   * "+$200" animation exactly once per event.
   */
  goCollectEvent?: { playerId: string; amount: number; id: number };

  // Timestamps
  createdAt: number;
  lastUpdateAt: number;
}

// Game actions (sent over network)
export type GameAction =
  | { type: 'JOIN_GAME'; playerId: string; playerName: string }
  | { type: 'LEAVE_GAME'; playerId: string }
  | { type: 'SELECT_TOKEN'; playerId: string; token: TokenType }
  | { type: 'READY_TO_START'; playerId: string }
  | { type: 'START_GAME'; turnOrder: string[] }
  | { type: 'ROLL_DICE'; playerId: string; result: [number, number]; seed: number }
  | { type: 'BUY_PROPERTY'; playerId: string; tileIndex: number }
  | { type: 'AUCTION_PROPERTY'; tileIndex: number }
  | { type: 'PLACE_BID'; playerId: string; amount: number }
  | { type: 'PASS_AUCTION'; playerId: string }
  | { type: 'PAY_RENT'; playerId: string; amount: number; toPlayerId: string }
  | { type: 'PAY_TAX'; playerId: string; amount: number }
  | { type: 'DRAW_CARD'; playerId: string; cardType: 'chance' | 'community-chest' }
  | { type: 'EXECUTE_CARD'; playerId: string; card: Card }
  | { type: 'BUILD_HOUSE'; playerId: string; tileIndex: number }
  | { type: 'SELL_HOUSE'; playerId: string; tileIndex: number }
  | { type: 'MORTGAGE_PROPERTY'; playerId: string; tileIndex: number }
  | { type: 'UNMORTGAGE_PROPERTY'; playerId: string; tileIndex: number }
  | { type: 'PAY_JAIL_FINE'; playerId: string }
  | { type: 'USE_JAIL_CARD'; playerId: string }
  | { type: 'ROLL_FOR_JAIL'; playerId: string; result: [number, number] }
  | { type: 'PROPOSE_TRADE'; offer: TradeOffer }
  | { type: 'ACCEPT_TRADE'; tradeId: string }
  | { type: 'REJECT_TRADE'; tradeId: string }
  | { type: 'CANCEL_TRADE'; tradeId: string }
  | { type: 'DECLARE_BANKRUPTCY'; playerId: string; creditorId: string | null }
  | { type: 'ROLL_AGAIN'; playerId: string }
  | { type: 'END_TURN'; playerId: string };

// Network message types
export type NetworkMessage =
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'ACTION_REQUEST'; action: GameAction }
  | { type: 'ACTION_RESULT'; success: boolean; error?: string }
  | { type: 'PLAYER_JOINED'; playerId: string; playerName: string }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'CHAT_MESSAGE'; playerId: string; message: string; timestamp: number };

// Signaling message types
export type SignalingMessage =
  | { type: 'create-room'; peerId: string }
  | { type: 'room-created'; roomId: string }
  | { type: 'join-room'; roomId: string; peerId: string }
  | { type: 'room-joined'; roomId: string; hostId: string; peers: string[] }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'offer'; fromPeerId: string; toPeerId: string; offer: RTCSessionDescriptionInit }
  | { type: 'answer'; fromPeerId: string; toPeerId: string; answer: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; fromPeerId: string; toPeerId: string; candidate: RTCIceCandidateInit }
  | { type: 'error'; message: string };
