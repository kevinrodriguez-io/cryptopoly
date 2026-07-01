'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/stores/game-store';
import { TOKEN_COLORS } from '@/lib/game/types';

interface ActiveToast {
  id: number;
  playerName: string;
  amount: number;
  tokenColor: string;
  isLocal: boolean;
}

/**
 * Shows a brief "+$200" popup whenever a player collects the GO salary.
 * Driven by `gameState.goCollectEvent`, which the engine bumps deterministically
 * for every client, so observers see the event too.
 */
export function GoCollectToast() {
  const [toast, setToast] = useState<ActiveToast | null>(null);

  // Subscribe to the store directly so we react to GO events as they happen.
  // setState lives inside the subscription callback (an external-system update),
  // which is the recommended way to bridge a store into React state.
  useEffect(() => {
    // Ignore any event already present when we mount (e.g. on a late join).
    let lastSeenId = useGameStore.getState().gameState?.goCollectEvent?.id ?? null;

    return useGameStore.subscribe((state) => {
      const event = state.gameState?.goCollectEvent;
      if (!event) return;

      if (lastSeenId === null) {
        lastSeenId = event.id;
        return;
      }
      if (event.id === lastSeenId) return;
      lastSeenId = event.id;

      const player = state.gameState?.players?.[event.playerId];
      if (!player) return;

      setToast({
        id: event.id,
        playerName: player.name,
        amount: event.amount,
        tokenColor: TOKEN_COLORS[player.token],
        isLocal: player.id === state.localPlayerId,
      });
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 z-40">
      <div
        key={toast.id}
        className="go-collect-pop flex items-center gap-3 rounded-2xl border border-white/20 bg-black/90 px-5 py-3 shadow-2xl"
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-black"
          style={{ backgroundColor: toast.tokenColor }}
        >
          GO
        </span>
        <div className="text-left">
          <div className="text-xs text-white/70">
            {toast.isLocal ? 'You passed GO' : `${toast.playerName} passed GO`}
          </div>
          <div className="text-2xl font-semibold text-white tabular-nums leading-tight">
            +${toast.amount.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
