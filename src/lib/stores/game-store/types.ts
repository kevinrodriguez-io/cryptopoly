// ============================================
// CRYPTOPOLY - Game store types
// ============================================

import type { GameState, GameAction, TokenType, TradeOffer } from '../../game/types';
import type { Draft } from 'immer';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export type SignalingMode = 'server' | 'paste';

export interface GameStore {
  roomId: string | null;
  localPlayerId: string | null;
  localPlayerName: string;
  isHost: boolean;
  isConnected: boolean;
  connectionError: string | null;
  /** 'paste' = no server, copy-paste SDP; 'server' = HTTP signaling API. */
  signalingMode: SignalingMode;
  /** Paste mode: host's connection string to share (set when offer is ready). */
  pasteConnectionString: string | null;
  /** Paste mode: guest's response string to share (set when answer is ready). */
  pasteResponseString: string | null;
  /** True when WebRTC peer connection is established (e.g. host pasted guest's link). */
  peerConnectionEstablished: boolean;
  gameState: GameState | null;
  selectedToken: TokenType | null;
  isRolling: boolean;
  diceResult: [number, number] | null;
  showPropertyCard: number | null;
  chatMessages: ChatMessage[];
  broadcastAction: ((action: GameAction) => void) | null;
  sendToHost: ((action: GameAction) => void) | null;

  setConnectionCallbacks: (
    broadcast: (action: GameAction) => void,
    sendToHost: (action: GameAction) => void
  ) => void;
  setPasteSignalingActions: (submitHost: (s: string) => boolean, submitGuest: (s: string) => boolean) => void;
  setPasteConnectionString: (s: string | null) => void;
  setPasteResponseString: (s: string | null) => void;
  setPeerConnectionEstablished: (value: boolean) => void;
  submitPasteHostOffer: ((s: string) => boolean) | null;
  submitPasteGuestResponse: ((s: string) => boolean) | null;

  createRoom: (playerName: string) => Promise<string | null>;
  joinRoom: (roomId: string, playerName: string) => Promise<string | null>;
  /** Create room without server (copy-paste signaling). Default path for P2P. */
  createRoomOffline: (playerName: string) => Promise<string | null>;
  /** Join room without server; guest pastes host's connection string in lobby. */
  joinRoomOffline: (roomId: string, playerName: string) => Promise<string | null>;
  selectToken: (token: TokenType) => void;
  startGame: () => void;

  rollDiceAction: () => void;
  applyDiceResult: (result: [number, number], seed: number) => void;
  buyProperty: () => void;
  auctionProperty: () => void;
  placeBid: (amount: number) => void;
  passAuction: () => void;
  payRent: () => void;
  payTax: () => void;
  drawCard: () => void;
  executeCard: () => void;
  buildHouse: (tileIndex: number) => void;
  sellHouse: (tileIndex: number) => void;
  mortgageProperty: (tileIndex: number) => void;
  unmortgageProperty: (tileIndex: number) => void;
  payJailFine: () => void;
  useJailCard: () => void;
  proposeTrade: (offer: Omit<TradeOffer, 'id' | 'status'>) => void;
  acceptTrade: (tradeId: string) => void;
  rejectTrade: (tradeId: string) => void;
  declareBankruptcy: (creditorId: string | null) => void;
  rollAgain: () => void;
  endTurn: () => void;

  applyStateUpdate: (state: GameState) => void;
  applyActionFromNetwork: (action: GameAction) => void;

  setShowPropertyCard: (tileIndex: number | null) => void;
  addChatMessage: (playerId: string, playerName: string, message: string) => void;
  sendChatMessage: (message: string) => void;

  reset: () => void;
}

export type StoreSet = (fn: (state: Draft<GameStore>) => void) => void;
export type StoreGet = () => GameStore;
