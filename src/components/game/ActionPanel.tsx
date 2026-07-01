'use client';

import { useState } from 'react';
import { useGameStore } from '@/lib/stores/game-store';
import { getCurrentPlayer } from '@/lib/game/engine';
import { TILES } from '@/lib/game/board-data';
import { CHANCE_DECK_NAME, COMMUNITY_CHEST_DECK_NAME } from '@/lib/game/constants';
import { cn } from '@/lib/utils';

export function ActionPanel() {
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const isRolling = useGameStore(state => state.isRolling);
  const diceResult = useGameStore(state => state.diceResult);

  const currentPlayer = gameState ? getCurrentPlayer(gameState) : null;
  const isMyTurn = currentPlayer?.id === localPlayerId;
  const myPlayer = gameState && localPlayerId ? gameState.players[localPlayerId] : null;

  const {
    rollDiceAction,
    buyProperty,
    auctionProperty,
    payRent,
    payTax,
    drawCard,
    executeCard,
    rollAgain,
    endTurn,
    payJailFine,
    useJailCard,
  } = useGameStore();

  const [bidAmount, setBidAmount] = useState(0);

  if (!gameState || gameState.phase !== 'playing' || !myPlayer) {
    return null;
  }

  const pendingAction = gameState.pendingAction;
  const canRoll = isMyTurn && !myPlayer.hasRolled && !isRolling && !pendingAction;

  // Rolling doubles earns another roll for the same player (after resolving the
  // tile they landed on). doublesCount > 0 excludes the "doubles to leave jail"
  // case, which never grants an extra roll.
  const lastRoll = gameState.currentDiceRoll;
  const earnedExtraRoll =
    isMyTurn &&
    myPlayer.hasRolled &&
    !pendingAction &&
    !myPlayer.inJail &&
    lastRoll !== null &&
    lastRoll[0] === lastRoll[1] &&
    gameState.doublesCount > 0;

  const canEndTurn = isMyTurn && myPlayer.hasRolled && !pendingAction && !earnedExtraRoll;

  // Jail options
  const inJail = myPlayer.inJail && isMyTurn && !myPlayer.hasRolled;

  return (
    <div className="rounded-lg border border-white/20 bg-black/90 p-4 w-80">
      {/* Turn indicator */}
      <div className="mb-4">
        <div className="text-xs text-white/60">Current Turn</div>
        <div className="text-base font-medium text-white">
          {currentPlayer?.name}
          {isMyTurn && <span className="text-white/80"> (You)</span>}
        </div>
      </div>

      {/* Dice result */}
      {diceResult && (
        <div className="mb-4 p-3 rounded-lg border border-white/10 text-center">
          <div className="text-2xl font-semibold text-white">
            {diceResult[0]} + {diceResult[1]} = {diceResult[0] + diceResult[1]}
          </div>
          {diceResult[0] === diceResult[1] && (
            <div className="text-xs text-white/70 mt-1">Doubles</div>
          )}
        </div>
      )}

      {/* Jail options */}
      {inJail && (
        <div className="mb-4 p-3 rounded-lg border border-white/30">
          <div className="text-sm text-white/90 mb-2">You're in Jail</div>
          <div className="space-y-2">
            <button
              onClick={payJailFine}
              disabled={myPlayer.money < 50}
              className="btn btn-secondary w-full text-sm"
            >
              Pay $50 Fine
            </button>
            {myPlayer.getOutOfJailCards > 0 && (
              <button
                onClick={useJailCard}
                className="btn btn-secondary w-full text-sm"
              >
                Use Get Out of Jail Card
              </button>
            )}
            <button
              onClick={rollDiceAction}
              disabled={isRolling}
              className="btn btn-primary w-full text-sm"
            >
              Roll for Doubles
            </button>
          </div>
        </div>
      )}

      {/* Main actions */}
      {!inJail && (
        <div className="space-y-3">
          {/* Roll Dice */}
          {canRoll && (
            <button
              onClick={rollDiceAction}
              disabled={isRolling}
              className="btn btn-primary w-full text-lg"
            >
              {isRolling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner w-5 h-5" />
                  Rolling...
                </span>
              ) : (
                'Roll Dice'
              )}
            </button>
          )}

          {/* Buy Property Decision */}
          {pendingAction?.type === 'buy-decision' && isMyTurn && (
            <div className="p-3 rounded-lg border border-white/30">
              <div className="text-sm text-white/80 mb-2">
                Buy {TILES[pendingAction.tileIndex].name}?
              </div>
              <div className="text-lg font-semibold text-white mb-3">
                ${pendingAction.price}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={buyProperty}
                  disabled={myPlayer.money < pendingAction.price}
                  className="btn btn-primary flex-1"
                >
                  Buy
                </button>
                <button
                  onClick={auctionProperty}
                  className="btn btn-secondary flex-1"
                >
                  Auction
                </button>
              </div>
            </div>
          )}

          {/* Pay Rent */}
          {pendingAction?.type === 'pay-rent' && isMyTurn && (
            <div className="p-3 rounded-lg border border-white/30">
              <div className="text-sm text-white/80 mb-2">
                Pay Rent to {gameState.players[pendingAction.toPlayerId]?.name}
              </div>
              <div className="text-lg font-semibold text-white mb-3">
                ${pendingAction.amount}
              </div>
              <button
                onClick={payRent}
                className="btn btn-danger w-full"
              >
                Pay Rent
              </button>
            </div>
          )}

          {/* Pay Tax */}
          {pendingAction?.type === 'pay-tax' && isMyTurn && (
            <div className="p-3 rounded-lg border border-white/30">
              <div className="text-sm text-white/80 mb-2">
                Pay Tax
              </div>
              <div className="text-lg font-semibold text-white mb-3">
                ${pendingAction.amount}
              </div>
              <button
                onClick={payTax}
                className="btn btn-danger w-full"
              >
                Pay Tax
              </button>
            </div>
          )}

          {/* Draw Card */}
          {pendingAction?.type === 'draw-card' && isMyTurn && (
            <div className="p-3 rounded-lg border border-white/30">
              <div className="text-sm text-white/80 mb-2">
                {pendingAction.cardType === 'chance' ? CHANCE_DECK_NAME : COMMUNITY_CHEST_DECK_NAME}
              </div>
              <button
                onClick={drawCard}
                className="btn btn-primary w-full"
              >
                Draw Card
              </button>
            </div>
          )}

          {/* Card Action */}
          {pendingAction?.type === 'card-action' && gameState.drawnCard && isMyTurn && (
            <div className="p-3 rounded-lg border border-white/30">
              <div className="text-base font-semibold text-white mb-1">
                {gameState.drawnCard.title}
              </div>
              <div className="text-sm text-white/70 mb-3">
                {gameState.drawnCard.description}
              </div>
              <button
                onClick={executeCard}
                className="btn btn-primary w-full"
              >
                OK
              </button>
            </div>
          )}

          {/* Auction */}
          {pendingAction?.type === 'auction' && (
            <div className="p-3 rounded-lg border border-white/30">
              <div className="text-sm text-white/80 mb-2">
                Auction: {TILES[pendingAction.tileIndex].name}
              </div>
              <div className="text-base text-white mb-2">
                Current Bid: ${pendingAction.currentBid}
                {pendingAction.currentBidderId && (
                  <span className="text-sm text-white/60 ml-2">
                    by {gameState.players[pendingAction.currentBidderId]?.name}
                  </span>
                )}
              </div>
              {pendingAction.participants.includes(myPlayer.id) && (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(parseInt(e.target.value) || 0)}
                    min={pendingAction.currentBid + 1}
                    max={myPlayer.money}
                    className="w-full"
                    placeholder="Enter bid amount"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        useGameStore.getState().placeBid(bidAmount);
                        setBidAmount(0);
                      }}
                      disabled={bidAmount <= pendingAction.currentBid || bidAmount > myPlayer.money}
                      className="btn btn-primary flex-1"
                    >
                      Bid
                    </button>
                    <button
                      onClick={() => useGameStore.getState().passAuction()}
                      className="btn btn-secondary flex-1"
                    >
                      Pass
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Roll Again (earned by rolling doubles) */}
          {earnedExtraRoll && (
            <button
              onClick={rollAgain}
              disabled={isRolling}
              className="btn btn-primary w-full text-lg"
            >
              Roll Again (Doubles)
            </button>
          )}

          {/* End Turn */}
          {canEndTurn && (
            <button
              onClick={endTurn}
              className="btn btn-secondary w-full"
            >
              End Turn
            </button>
          )}
        </div>
      )}

      {/* Not your turn message */}
      {!isMyTurn && (
        <div className="text-center text-white/50 text-sm py-4">
          Waiting for {currentPlayer?.name}...
        </div>
      )}
    </div>
  );
}
