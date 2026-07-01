// ============================================
// CRYPTOPOLY - Game actions (roll, buy, pay, build, jail, end turn)
// ============================================

import type { GameAction } from '../../../game/types';
import { createInitialState, applyAction, getCurrentPlayer, canBuildHouse, canSellHouse } from '../../../game/engine';
import type { StoreSet, StoreGet } from '../types';

export function createGameActions(set: StoreSet, get: StoreGet) {
  return {
    rollDiceAction: () => {
      const { localPlayerId, gameState } = get();
      if (!localPlayerId || !gameState) return;

      const currentPlayer = getCurrentPlayer(gameState);
      if (!currentPlayer || currentPlayer.id !== localPlayerId) return;
      if (currentPlayer.hasRolled && !gameState.currentDiceRoll) return;

      set(state => { state.isRolling = true; });
    },

    applyDiceResult: (result: [number, number], seed: number) => {
      const { localPlayerId, isHost, broadcastAction, sendToHost } = get();
      if (!localPlayerId) return;

      const action: GameAction = { type: 'ROLL_DICE', playerId: localPlayerId, result, seed };
      get().applyActionFromNetwork(action);
      if (isHost) broadcastAction?.(action);
      else sendToHost?.(action);

      set(state => {
        state.isRolling = false;
        state.diceResult = result;
      });
    },

    buyProperty: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState?.pendingAction) return;
      if (gameState.pendingAction.type !== 'buy-decision') return;

      const action: GameAction = {
        type: 'BUY_PROPERTY',
        playerId: localPlayerId,
        tileIndex: gameState.pendingAction.tileIndex,
      };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    auctionProperty: () => {
      const { isHost, broadcastAction, sendToHost, gameState } = get();
      if (!gameState?.pendingAction) return;
      if (gameState.pendingAction.type !== 'buy-decision') return;

      const action: GameAction = { type: 'AUCTION_PROPERTY', tileIndex: gameState.pendingAction.tileIndex };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else {
        sendToHost?.(action);
      }
    },

    placeBid: (amount: number) => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState?.pendingAction) return;
      if (gameState.pendingAction.type !== 'auction') return;

      const player = gameState.players[localPlayerId];
      if (!player || amount > player.money) return;
      if (amount <= gameState.pendingAction.currentBid) return;

      const action: GameAction = { type: 'PLACE_BID', playerId: localPlayerId, amount };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    passAuction: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState?.pendingAction) return;
      if (gameState.pendingAction.type !== 'auction') return;

      const action: GameAction = { type: 'PASS_AUCTION', playerId: localPlayerId };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    payRent: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState?.pendingAction) return;
      if (gameState.pendingAction.type !== 'pay-rent') return;

      const action: GameAction = {
        type: 'PAY_RENT',
        playerId: localPlayerId,
        amount: gameState.pendingAction.amount,
        toPlayerId: gameState.pendingAction.toPlayerId,
      };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    payTax: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState?.pendingAction) return;
      if (gameState.pendingAction.type !== 'pay-tax') return;

      const action: GameAction = {
        type: 'PAY_TAX',
        playerId: localPlayerId,
        amount: gameState.pendingAction.amount,
      };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    drawCard: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState?.pendingAction) return;
      if (gameState.pendingAction.type !== 'draw-card') return;

      const action: GameAction = {
        type: 'DRAW_CARD',
        playerId: localPlayerId,
        cardType: gameState.pendingAction.cardType,
      };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    executeCard: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState?.pendingAction || !gameState.drawnCard) return;
      if (gameState.pendingAction.type !== 'card-action') return;

      const action: GameAction = {
        type: 'EXECUTE_CARD',
        playerId: localPlayerId,
        card: gameState.drawnCard,
      };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    buildHouse: (tileIndex: number) => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState) return;
      if (!canBuildHouse(localPlayerId, tileIndex, gameState)) return;

      const action: GameAction = { type: 'BUILD_HOUSE', playerId: localPlayerId, tileIndex };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    sellHouse: (tileIndex: number) => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState) return;
      if (!canSellHouse(localPlayerId, tileIndex, gameState)) return;

      const action: GameAction = { type: 'SELL_HOUSE', playerId: localPlayerId, tileIndex };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    mortgageProperty: (tileIndex: number) => {
      const { localPlayerId, isHost, broadcastAction, sendToHost } = get();
      if (!localPlayerId) return;

      const action: GameAction = { type: 'MORTGAGE_PROPERTY', playerId: localPlayerId, tileIndex };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    unmortgageProperty: (tileIndex: number) => {
      const { localPlayerId, isHost, broadcastAction, sendToHost } = get();
      if (!localPlayerId) return;

      const action: GameAction = { type: 'UNMORTGAGE_PROPERTY', playerId: localPlayerId, tileIndex };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    payJailFine: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost } = get();
      if (!localPlayerId) return;

      const action: GameAction = { type: 'PAY_JAIL_FINE', playerId: localPlayerId };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    useJailCard: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost } = get();
      if (!localPlayerId) return;

      const action: GameAction = { type: 'USE_JAIL_CARD', playerId: localPlayerId };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    declareBankruptcy: (creditorId: string | null) => {
      const { localPlayerId, isHost, broadcastAction, sendToHost } = get();
      if (!localPlayerId) return;

      const action: GameAction = { type: 'DECLARE_BANKRUPTCY', playerId: localPlayerId, creditorId };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);
    },

    rollAgain: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState) return;

      const currentPlayer = getCurrentPlayer(gameState);
      if (!currentPlayer || currentPlayer.id !== localPlayerId) return;

      // Reset roll state for the extra (doubles) turn, then immediately start
      // a fresh physics roll for this same player.
      const action: GameAction = { type: 'ROLL_AGAIN', playerId: localPlayerId };
      get().applyActionFromNetwork(action);
      if (isHost) broadcastAction?.(action);
      else sendToHost?.(action);

      set(state => {
        state.diceResult = null;
        state.isRolling = true;
      });
    },

    endTurn: () => {
      const { localPlayerId, isHost, broadcastAction, sendToHost, gameState } = get();
      if (!localPlayerId || !gameState) return;

      const currentPlayer = getCurrentPlayer(gameState);
      if (!currentPlayer || currentPlayer.id !== localPlayerId) return;

      const action: GameAction = { type: 'END_TURN', playerId: localPlayerId };
      if (isHost) {
        get().applyActionFromNetwork(action);
        broadcastAction?.(action);
      } else sendToHost?.(action);

      set(state => { state.diceResult = null; });
    },
  };
}
