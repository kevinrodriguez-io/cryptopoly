// ============================================
// CRYPTOPOLY - Apply game action (main reducer)
// ============================================

import type { GameState, GameAction, PropertyTile, TokenType, PendingAction } from '../types';
import { TILES, shuffleArray } from '../board-data';
import {
  JAIL_FINE,
  JAIL_INDEX,
  AVAILABLE_TOKENS,
  DEFAULT_TOKEN,
  UNMORTGAGE_MULTIPLIER,
  HOUSE_SELL_BACK_RATIO,
} from './constants';
import { createPlayer } from './state';
import { getCurrentPlayer, getNextPlayerIndex } from './players';
import { executeCardAction } from './tiles';
import { canAfford, canBuildHouse, canSellHouse, checkWinner } from './validation';
import { handleRollDice } from './apply-action-roll';
import { isDoubles } from './dice';

type AuctionAction = Extract<PendingAction, { type: 'auction' }>;

// Hands the auctioned property to the current high bidder and closes the auction.
function awardAuctionToBidder(newState: GameState, auction: AuctionAction): void {
  const winnerId = auction.currentBidderId;
  if (!winnerId) return;
  const winner = newState.players[winnerId];
  newState.players = {
    ...newState.players,
    [winnerId]: {
      ...winner,
      money: winner.money - auction.currentBid,
      properties: [...winner.properties, auction.tileIndex],
    },
  };
  newState.properties = {
    ...newState.properties,
    [auction.tileIndex]: {
      ...newState.properties[auction.tileIndex],
      ownerId: winnerId,
    },
  };
  newState.pendingAction = null;
  newState.turnPhase = 'post-roll';
}

export function applyAction(state: GameState, action: GameAction): GameState {
  const newState = { ...state, lastUpdateAt: Date.now() };

  switch (action.type) {
    case 'JOIN_GAME': {
      if (newState.players[action.playerId]) {
        newState.players = {
          ...newState.players,
          [action.playerId]: {
            ...newState.players[action.playerId],
            name: action.playerName,
          },
        };
        break;
      }
      const existingTokens = Object.values(newState.players).map(p => p.token);
      const defaultToken = AVAILABLE_TOKENS.find(t => !existingTokens.includes(t)) ?? DEFAULT_TOKEN;

      newState.players = {
        ...newState.players,
        [action.playerId]: createPlayer(action.playerId, action.playerName, defaultToken),
      };
      break;
    }

    case 'LEAVE_GAME': {
      const { [action.playerId]: _, ...remainingPlayers } = newState.players;
      newState.players = remainingPlayers;
      newState.turnOrder = newState.turnOrder.filter(id => id !== action.playerId);
      break;
    }

    case 'SELECT_TOKEN': {
      if (newState.players[action.playerId]) {
        newState.players = {
          ...newState.players,
          [action.playerId]: {
            ...newState.players[action.playerId],
            token: action.token,
          },
        };
      }
      break;
    }

    case 'START_GAME': {
      newState.phase = 'playing';
      newState.turnOrder = action.turnOrder?.length
        ? action.turnOrder.filter(id => id in newState.players)
        : shuffleArray(Object.keys(newState.players));
      newState.currentPlayerIndex = 0;
      newState.turnPhase = 'pre-roll';
      break;
    }

    case 'ROLL_DICE':
      handleRollDice(newState, action);
      break;

    case 'BUY_PROPERTY': {
      const player = newState.players[action.playerId];
      const tile = TILES[action.tileIndex];
      if (!player || (tile.type !== 'property' && tile.type !== 'railroad' && tile.type !== 'utility')) break;

      const price = 'price' in tile ? tile.price : 0;
      if (!canAfford(player, price)) break;

      newState.players = {
        ...newState.players,
        [action.playerId]: {
          ...player,
          money: player.money - price,
          properties: [...player.properties, action.tileIndex],
        },
      };
      newState.properties = {
        ...newState.properties,
        [action.tileIndex]: {
          ...newState.properties[action.tileIndex],
          ownerId: action.playerId,
        },
      };
      newState.pendingAction = null;
      newState.turnPhase = 'post-roll';
      break;
    }

    case 'AUCTION_PROPERTY': {
      newState.pendingAction = {
        type: 'auction',
        tileIndex: action.tileIndex,
        currentBid: 0,
        currentBidderId: null,
        participants: Object.keys(newState.players).filter(id => !newState.players[id].isBankrupt),
      };
      break;
    }

    case 'PLACE_BID': {
      if (newState.pendingAction?.type !== 'auction') break;
      const auction = newState.pendingAction;
      // Ignore bids from players who already passed / aren't in the auction.
      if (!auction.participants.includes(action.playerId)) break;

      const updatedAuction: AuctionAction = {
        ...auction,
        currentBid: action.amount,
        currentBidderId: action.playerId,
      };

      // If this bidder is the only participant left, their bid wins immediately
      // (there's no one else who could pass to end the auction).
      if (auction.participants.length === 1) {
        awardAuctionToBidder(newState, updatedAuction);
      } else {
        newState.pendingAction = updatedAuction;
      }
      break;
    }

    case 'PASS_AUCTION': {
      if (newState.pendingAction?.type !== 'auction') break;
      const auction = newState.pendingAction;
      // Ignore passes from players who aren't part of this auction (e.g. duplicates).
      if (!auction.participants.includes(action.playerId)) break;
      const remaining = auction.participants.filter(id => id !== action.playerId);

      // Everyone else has dropped out and the high bidder is the last one standing.
      const onlyBidderLeft =
        auction.currentBidderId !== null &&
        remaining.length === 1 &&
        remaining[0] === auction.currentBidderId;

      if (onlyBidderLeft || (remaining.length === 0 && auction.currentBidderId !== null)) {
        awardAuctionToBidder(newState, auction);
      } else if (remaining.length === 0) {
        // Everyone passed without ever bidding: the property stays unowned.
        newState.pendingAction = null;
        newState.turnPhase = 'post-roll';
      } else {
        // Auction continues; the remaining players can still bid or pass.
        newState.pendingAction = {
          ...auction,
          participants: remaining,
        };
      }
      break;
    }

    case 'PAY_RENT': {
      const payer = newState.players[action.playerId];
      const receiver = newState.players[action.toPlayerId];
      if (!payer || !receiver) break;

      newState.players = {
        ...newState.players,
        [action.playerId]: { ...payer, money: payer.money - action.amount },
        [action.toPlayerId]: { ...receiver, money: receiver.money + action.amount },
      };
      newState.pendingAction = null;
      newState.turnPhase = 'post-roll';
      break;
    }

    case 'PAY_TAX': {
      const player = newState.players[action.playerId];
      if (!player) break;

      newState.players = {
        ...newState.players,
        [action.playerId]: { ...player, money: player.money - action.amount },
      };
      newState.freeParking += action.amount;
      newState.pendingAction = null;
      newState.turnPhase = 'post-roll';
      break;
    }

    case 'DRAW_CARD': {
      const deck = action.cardType === 'chance' ? newState.chanceCards : newState.communityChestCards;
      if (deck.length === 0) break;

      const [drawnCard, ...remainingCards] = deck;
      newState.drawnCard = drawnCard;

      if (action.cardType === 'chance') {
        newState.chanceCards = remainingCards;
      } else {
        newState.communityChestCards = remainingCards;
      }

      newState.pendingAction = { type: 'card-action', card: drawnCard };
      break;
    }

    case 'EXECUTE_CARD': {
      const player = newState.players[action.playerId];
      if (!player) break;

      executeCardAction(newState, player.id, action.card);
      newState.drawnCard = null;
      newState.pendingAction = null;
      newState.turnPhase = 'post-roll';
      break;
    }

    case 'BUILD_HOUSE': {
      if (!canBuildHouse(action.playerId, action.tileIndex, newState)) break;

      const tile = TILES[action.tileIndex] as PropertyTile;
      const player = newState.players[action.playerId];

      newState.players = {
        ...newState.players,
        [action.playerId]: { ...player, money: player.money - tile.houseCost },
      };
      newState.properties = {
        ...newState.properties,
        [action.tileIndex]: {
          ...newState.properties[action.tileIndex],
          houses: newState.properties[action.tileIndex].houses + 1,
        },
      };
      break;
    }

    case 'SELL_HOUSE': {
      if (!canSellHouse(action.playerId, action.tileIndex, newState)) break;

      const tile = TILES[action.tileIndex] as PropertyTile;
      const player = newState.players[action.playerId];

      newState.players = {
        ...newState.players,
        [action.playerId]: { ...player, money: player.money + Math.floor(tile.houseCost * HOUSE_SELL_BACK_RATIO) },
      };
      newState.properties = {
        ...newState.properties,
        [action.tileIndex]: {
          ...newState.properties[action.tileIndex],
          houses: newState.properties[action.tileIndex].houses - 1,
        },
      };
      break;
    }

    case 'MORTGAGE_PROPERTY': {
      const player = newState.players[action.playerId];
      const tile = TILES[action.tileIndex];
      const propertyState = newState.properties[action.tileIndex];

      if (!player || propertyState?.ownerId !== action.playerId) break;
      if (propertyState.isMortgaged) break;
      if (propertyState.houses > 0) break;

      const mortgage = 'mortgage' in tile ? tile.mortgage : 0;

      newState.players = {
        ...newState.players,
        [action.playerId]: { ...player, money: player.money + mortgage },
      };
      newState.properties = {
        ...newState.properties,
        [action.tileIndex]: { ...propertyState, isMortgaged: true },
      };
      break;
    }

    case 'UNMORTGAGE_PROPERTY': {
      const player = newState.players[action.playerId];
      const tile = TILES[action.tileIndex];
      const propertyState = newState.properties[action.tileIndex];

      if (!player || propertyState?.ownerId !== action.playerId) break;
      if (!propertyState.isMortgaged) break;

      const mortgage = 'mortgage' in tile ? tile.mortgage : 0;
      const unmortgageCost = Math.floor(mortgage * UNMORTGAGE_MULTIPLIER);

      if (!canAfford(player, unmortgageCost)) break;

      newState.players = {
        ...newState.players,
        [action.playerId]: { ...player, money: player.money - unmortgageCost },
      };
      newState.properties = {
        ...newState.properties,
        [action.tileIndex]: { ...propertyState, isMortgaged: false },
      };
      break;
    }

    case 'PAY_JAIL_FINE': {
      const player = newState.players[action.playerId];
      if (!player || !player.inJail) break;
      if (!canAfford(player, JAIL_FINE)) break;

      newState.players = {
        ...newState.players,
        [action.playerId]: {
          ...player,
          money: player.money - JAIL_FINE,
          inJail: false,
          jailTurns: 0,
        },
      };
      break;
    }

    case 'USE_JAIL_CARD': {
      const player = newState.players[action.playerId];
      if (!player || !player.inJail || player.getOutOfJailCards < 1) break;

      newState.players = {
        ...newState.players,
        [action.playerId]: {
          ...player,
          inJail: false,
          jailTurns: 0,
          getOutOfJailCards: player.getOutOfJailCards - 1,
        },
      };
      break;
    }

    case 'PROPOSE_TRADE': {
      newState.tradeOffers = [...newState.tradeOffers, action.offer];
      break;
    }

    case 'ACCEPT_TRADE': {
      const trade = newState.tradeOffers.find(t => t.id === action.tradeId);
      if (!trade || trade.status !== 'pending') break;

      const fromPlayer = newState.players[trade.fromPlayerId];
      const toPlayer = newState.players[trade.toPlayerId];
      if (!fromPlayer || !toPlayer) break;

      newState.players = {
        ...newState.players,
        [trade.fromPlayerId]: {
          ...fromPlayer,
          money: fromPlayer.money - trade.offeredMoney + trade.requestedMoney,
          properties: [
            ...fromPlayer.properties.filter(p => !trade.offeredProperties.includes(p)),
            ...trade.requestedProperties,
          ],
        },
        [trade.toPlayerId]: {
          ...toPlayer,
          money: toPlayer.money + trade.offeredMoney - trade.requestedMoney,
          properties: [
            ...toPlayer.properties.filter(p => !trade.requestedProperties.includes(p)),
            ...trade.offeredProperties,
          ],
        },
      };

      for (const propIdx of trade.offeredProperties) {
        newState.properties[propIdx] = {
          ...newState.properties[propIdx],
          ownerId: trade.toPlayerId,
        };
      }
      for (const propIdx of trade.requestedProperties) {
        newState.properties[propIdx] = {
          ...newState.properties[propIdx],
          ownerId: trade.fromPlayerId,
        };
      }

      newState.tradeOffers = newState.tradeOffers.map(t =>
        t.id === action.tradeId ? { ...t, status: 'accepted' as const } : t
      );
      break;
    }

    case 'REJECT_TRADE': {
      newState.tradeOffers = newState.tradeOffers.map(t =>
        t.id === action.tradeId ? { ...t, status: 'rejected' as const } : t
      );
      break;
    }

    case 'CANCEL_TRADE': {
      newState.tradeOffers = newState.tradeOffers.map(t =>
        t.id === action.tradeId ? { ...t, status: 'cancelled' as const } : t
      );
      break;
    }

    case 'DECLARE_BANKRUPTCY': {
      const player = newState.players[action.playerId];
      if (!player) break;

      if (action.creditorId && newState.players[action.creditorId]) {
        const creditor = newState.players[action.creditorId];
        newState.players = {
          ...newState.players,
          [action.creditorId]: {
            ...creditor,
            money: creditor.money + player.money,
            properties: [...creditor.properties, ...player.properties],
            getOutOfJailCards: creditor.getOutOfJailCards + player.getOutOfJailCards,
          },
        };
        for (const propIdx of player.properties) {
          newState.properties[propIdx] = {
            ...newState.properties[propIdx],
            ownerId: action.creditorId,
          };
        }
      } else {
        for (const propIdx of player.properties) {
          newState.properties[propIdx] = {
            ownerId: null,
            houses: 0,
            isMortgaged: false,
          };
        }
      }

      newState.players = {
        ...newState.players,
        [action.playerId]: {
          ...player,
          isBankrupt: true,
          money: 0,
          properties: [],
        },
      };

      const winner = checkWinner(newState);
      if (winner) {
        newState.winnerId = winner;
        newState.phase = 'finished';
      }
      break;
    }

    case 'ROLL_AGAIN': {
      // Extra turn earned by rolling doubles: the SAME player rolls again.
      // We keep doublesCount (so a 3rd consecutive double still sends to jail)
      // and the current player; we just reset the roll state so they can roll.
      // Note: rolling doubles to leave jail does NOT grant an extra roll — that
      // path never increments doublesCount, so it's excluded here.
      const currentPlayer = getCurrentPlayer(newState);
      if (!currentPlayer || currentPlayer.id !== action.playerId) break;

      const roll = newState.currentDiceRoll;
      const earnedExtraRoll =
        roll !== null && isDoubles(roll) && newState.doublesCount > 0 && !currentPlayer.inJail;
      if (!earnedExtraRoll) break;

      newState.currentDiceRoll = null;
      newState.turnPhase = 'pre-roll';
      newState.pendingAction = null;
      newState.players = {
        ...newState.players,
        [currentPlayer.id]: { ...currentPlayer, hasRolled: false },
      };
      break;
    }

    case 'END_TURN': {
      const currentPlayer = getCurrentPlayer(newState);
      if (!currentPlayer || currentPlayer.id !== action.playerId) break;

      const nextPlayerIndex = getNextPlayerIndex(newState);
      newState.currentPlayerIndex = nextPlayerIndex;
      newState.currentDiceRoll = null;
      newState.doublesCount = 0;
      newState.turnPhase = 'pre-roll';
      newState.pendingAction = null;

      newState.players = {
        ...newState.players,
        [currentPlayer.id]: { ...currentPlayer, hasRolled: false },
      };

      newState.tradeOffers = newState.tradeOffers.filter(t => t.status === 'pending');
      break;
    }
  }

  return newState;
}
