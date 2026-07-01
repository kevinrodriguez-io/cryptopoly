// ============================================
// CRYPTOPOLY - ROLL_DICE action handler
// ============================================

import type { GameState } from '../types';
import { TILES } from '../board-data';
import { JAIL_FINE, JAIL_INDEX, MAX_DOUBLES } from './constants';
import { getDiceTotal, isDoubles } from './dice';
import { applyGoSalary, movePlayer } from './movement';
import { getCurrentPlayer } from './players';
import { handleLandOnTile } from './tiles';

export function handleRollDice(
  newState: GameState,
  action: { type: 'ROLL_DICE'; playerId: string; result: [number, number]; seed: number }
): void {
  const currentPlayer = getCurrentPlayer(newState);
  if (!currentPlayer || currentPlayer.id !== action.playerId) return;

  // Idempotency: every physical roll carries a unique seed. If we've already
  // applied this exact roll, skip it. This is robust even when a doubles roll
  // resets state for an extra roll (where currentDiceRoll is cleared), so a
  // late-arriving duplicate of a previous roll can never move the player twice.
  if (action.seed && newState.lastDiceRollSeed === action.seed) {
    return;
  }

  newState.currentDiceRoll = action.result;
  newState.lastDiceRollId = (newState.lastDiceRollId ?? 0) + 1;
  newState.lastDiceRollSeed = action.seed;
  const isDouble = isDoubles(action.result);
  const total = getDiceTotal(action.result);

  if (currentPlayer.inJail) {
    if (isDouble) {
      newState.players = {
        ...newState.players,
        [currentPlayer.id]: {
          ...currentPlayer,
          inJail: false,
          jailTurns: 0,
          hasRolled: true,
        },
      };
    } else {
      const newJailTurns = currentPlayer.jailTurns + 1;
      if (newJailTurns >= 3) {
        newState.players = {
          ...newState.players,
          [currentPlayer.id]: {
            ...currentPlayer,
            inJail: false,
            jailTurns: 0,
            money: currentPlayer.money - JAIL_FINE,
            hasRolled: true,
          },
        };
      } else {
        newState.players = {
          ...newState.players,
          [currentPlayer.id]: {
            ...currentPlayer,
            jailTurns: newJailTurns,
            hasRolled: true,
          },
        };
        newState.turnPhase = 'end-turn';
        return;
      }
    }

    // Player was released from jail this turn (rolled doubles or paid the fine
    // after 3 turns): move them, credit GO if applicable, and resolve whatever
    // tile they land on (draw-card, buy-decision, rent, tax, etc.).
    const releasedPlayer = newState.players[currentPlayer.id];
    const { newPosition, passedGo } = movePlayer(releasedPlayer, total, newState);
    newState.players[currentPlayer.id] = { ...releasedPlayer, position: newPosition };
    if (passedGo) applyGoSalary(newState, currentPlayer.id);

    newState.turnPhase = 'action';
    handleLandOnTile(newState, currentPlayer.id, TILES[newPosition]);
    return;
  }

  if (isDouble) {
    newState.doublesCount += 1;
    if (newState.doublesCount >= MAX_DOUBLES) {
      newState.players = {
        ...newState.players,
        [currentPlayer.id]: {
          ...currentPlayer,
          position: JAIL_INDEX,
          inJail: true,
          hasRolled: true,
        },
      };
      newState.doublesCount = 0;
      newState.turnPhase = 'end-turn';
      return;
    }
  }

  const { newPosition, passedGo } = movePlayer(currentPlayer, total, newState);
  newState.players = {
    ...newState.players,
    [currentPlayer.id]: {
      ...currentPlayer,
      position: newPosition,
      hasRolled: true,
    },
  };
  if (passedGo) applyGoSalary(newState, currentPlayer.id);

  newState.turnPhase = 'action';
  const landedTile = TILES[newPosition];
  handleLandOnTile(newState, currentPlayer.id, landedTile);
}
