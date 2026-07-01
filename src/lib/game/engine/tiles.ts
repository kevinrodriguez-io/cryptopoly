// ============================================
// CRYPTOPOLY - Tile landing and card execution
// ============================================

import type { GameState, Tile, Card } from '../types';
import { TILES, getNextRailroadIndex, getNextUtilityIndex } from '../board-data';
import { JAIL_INDEX, BOARD_SIZE } from './constants';
import { applyGoSalary } from './movement';
import { calculateRent } from './rent';

export function handleLandOnTile(state: GameState, playerId: string, tile: Tile): void {
  const player = state.players[playerId];
  if (!player) return;

  switch (tile.type) {
    case 'property':
    case 'railroad':
    case 'utility': {
      const propertyState = state.properties[tile.index];
      if (!propertyState.ownerId) {
        const price = 'price' in tile ? tile.price : 0;
        state.pendingAction = {
          type: 'buy-decision',
          tileIndex: tile.index,
          price,
        };
      } else if (propertyState.ownerId !== playerId && !propertyState.isMortgaged) {
        const rent = calculateRent(tile, state, state.currentDiceRoll || undefined);
        state.pendingAction = {
          type: 'pay-rent',
          amount: rent,
          toPlayerId: propertyState.ownerId,
        };
      }
      break;
    }

    case 'chance':
      state.pendingAction = { type: 'draw-card', cardType: 'chance' };
      break;

    case 'community-chest':
      state.pendingAction = { type: 'draw-card', cardType: 'community-chest' };
      break;

    case 'tax': {
      state.pendingAction = {
        type: 'pay-tax',
        amount: tile.amount,
      };
      break;
    }

    case 'go-to-jail': {
      state.players[playerId] = {
        ...player,
        position: JAIL_INDEX,
        inJail: true,
      };
      state.doublesCount = 0;
      state.turnPhase = 'end-turn';
      break;
    }

    case 'free-parking': {
      if (state.freeParking > 0) {
        state.players[playerId] = {
          ...player,
          money: player.money + state.freeParking,
        };
        state.freeParking = 0;
      }
      break;
    }

    case 'go':
    case 'jail':
      break;
  }
}

export function executeCardAction(state: GameState, playerId: string, card: Card): void {
  const player = state.players[playerId];
  if (!player) return;

  const action = card.action;

  switch (action.type) {
    case 'collect': {
      state.players[playerId] = {
        ...player,
        money: player.money + action.amount,
      };
      break;
    }

    case 'pay': {
      state.players[playerId] = {
        ...player,
        money: player.money - action.amount,
      };
      state.freeParking += action.amount;
      break;
    }

    case 'pay-each-player': {
      const otherPlayers = Object.values(state.players).filter(
        p => p.id !== playerId && !p.isBankrupt
      );
      const totalPay = action.amount * otherPlayers.length;
      state.players[playerId] = {
        ...player,
        money: player.money - totalPay,
      };
      for (const other of otherPlayers) {
        state.players[other.id] = {
          ...other,
          money: other.money + action.amount,
        };
      }
      break;
    }

    case 'collect-from-each': {
      const otherPlayers = Object.values(state.players).filter(
        p => p.id !== playerId && !p.isBankrupt
      );
      let totalCollect = 0;
      for (const other of otherPlayers) {
        const payment = Math.min(action.amount, other.money);
        totalCollect += payment;
        state.players[other.id] = {
          ...other,
          money: other.money - payment,
        };
      }
      state.players[playerId] = {
        ...player,
        money: player.money + totalCollect,
      };
      break;
    }

    case 'move-to': {
      const oldPosition = player.position;
      const newPosition = action.tileIndex;
      // Landing directly on GO always pays the salary (e.g. "Advance to GO").
      // Otherwise, passing GO pays only when the card allows it.
      const landsOnGo = newPosition === 0;
      const passedGo = action.collectGo !== false && newPosition < oldPosition && !landsOnGo;

      state.players[playerId] = {
        ...player,
        position: newPosition,
      };
      if (passedGo || landsOnGo) applyGoSalary(state, playerId);

      const landedTile = TILES[newPosition];
      handleLandOnTile(state, playerId, landedTile);
      break;
    }

    case 'move-back': {
      let newPosition = player.position - action.spaces;
      if (newPosition < 0) newPosition += BOARD_SIZE;

      state.players[playerId] = {
        ...player,
        position: newPosition,
      };

      const landedTile = TILES[newPosition];
      handleLandOnTile(state, playerId, landedTile);
      break;
    }

    case 'go-to-jail': {
      state.players[playerId] = {
        ...player,
        position: JAIL_INDEX,
        inJail: true,
      };
      state.doublesCount = 0;
      break;
    }

    case 'get-out-of-jail-free': {
      state.players[playerId] = {
        ...player,
        getOutOfJailCards: player.getOutOfJailCards + 1,
      };
      break;
    }

    case 'repairs': {
      let totalCost = 0;
      for (const propIdx of player.properties) {
        const propState = state.properties[propIdx];
        if (propState && propState.houses > 0) {
          if (propState.houses === 5) {
            totalCost += action.perHotel;
          } else {
            totalCost += propState.houses * action.perHouse;
          }
        }
      }
      state.players[playerId] = {
        ...player,
        money: player.money - totalCost,
      };
      state.freeParking += totalCost;
      break;
    }

    case 'advance-to-nearest': {
      let targetIndex: number;
      if (action.tileType === 'railroad') {
        targetIndex = getNextRailroadIndex(player.position);
      } else {
        targetIndex = getNextUtilityIndex(player.position);
      }

      const passedGo = targetIndex < player.position;
      state.players[playerId] = {
        ...player,
        position: targetIndex,
      };
      if (passedGo) applyGoSalary(state, playerId);

      const landedTile = TILES[targetIndex];
      const propertyState = state.properties[targetIndex];

      if (propertyState?.ownerId && propertyState.ownerId !== playerId && !propertyState.isMortgaged) {
        let rent = calculateRent(landedTile, state, state.currentDiceRoll || undefined);
        if (action.payMultiple) {
          rent *= action.payMultiple;
        }
        state.pendingAction = {
          type: 'pay-rent',
          amount: rent,
          toPlayerId: propertyState.ownerId,
        };
      } else if (!propertyState?.ownerId) {
        const price = 'price' in landedTile ? landedTile.price : 0;
        state.pendingAction = {
          type: 'buy-decision',
          tileIndex: targetIndex,
          price,
        };
      }
      break;
    }
  }
}
