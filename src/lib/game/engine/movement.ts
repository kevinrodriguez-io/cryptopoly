// ============================================
// CRYPTOPOLY - Player movement
// ============================================

import type { GameState, Player } from '../types';
import { BOARD_SIZE, GO_SALARY } from './constants';

export function movePlayer(
  player: Player,
  spaces: number,
  _state: GameState
): { newPosition: number; passedGo: boolean } {
  const oldPosition = player.position;
  let newPosition = (oldPosition + spaces) % BOARD_SIZE;
  if (newPosition < 0) newPosition += BOARD_SIZE;

  const passedGo = spaces > 0 && newPosition < oldPosition;

  return { newPosition, passedGo };
}

/**
 * Credit a player the GO salary and record a `goCollectEvent` so the UI can
 * animate a "+$200" popup. Call this anywhere a player passes/lands on GO.
 */
export function applyGoSalary(state: GameState, playerId: string): void {
  const player = state.players[playerId];
  if (!player) return;

  state.players[playerId] = { ...player, money: player.money + GO_SALARY };
  state.goCollectEvent = {
    playerId,
    amount: GO_SALARY,
    id: (state.goCollectEvent?.id ?? 0) + 1,
  };
}
