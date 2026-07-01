'use client';

import { useCallback, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useGameStore } from '@/lib/stores/game-store';
import { GAME_NAME } from '@/lib/game/constants';
import { PlayerPanel } from '@/components/game/PlayerPanel';
import { ActionPanel } from '@/components/game/ActionPanel';
import { PropertyCard } from '@/components/game/PropertyCard';
import { GoCollectToast } from '@/components/game/GoCollectToast';

// Dynamically import the 3D scene to avoid SSR issues
const GameScene = dynamic(
  () => import('@/components/three/Scene').then(mod => ({ default: mod.GameScene })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <div className="text-white/60 text-sm">Loading 3D scene...</div>
        </div>
      </div>
    ),
  }
);

function GameHeader() {
  const roomId = useGameStore(state => state.roomId);
  const gameState = useGameStore(state => state.gameState);
  const router = useRouter();

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave the game?')) {
      useGameStore.getState().reset();
      router.push('/');
    }
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-white tracking-tight">{GAME_NAME.toUpperCase()}</h1>
        {roomId && (
          <div className="px-3 py-1.5 rounded-lg border border-white/20 text-sm">
            <span className="text-white/60">Room </span>
            <span className="text-white font-medium">{roomId}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {gameState?.phase === 'finished' && gameState.winnerId && (
          <div className="px-4 py-2 rounded-lg border border-white/20 text-sm">
            <span className="text-white/70">Winner </span>
            <span className="text-white font-medium">
              {gameState.players[gameState.winnerId]?.name}
            </span>
          </div>
        )}
        <button
          onClick={handleLeave}
          className="btn btn-secondary text-sm px-4 py-2"
        >
          Leave Game
        </button>
      </div>
    </header>
  );
}

function WinnerOverlay() {
  const gameState = useGameStore(state => state.gameState);
  const router = useRouter();

  if (gameState?.phase !== 'finished' || !gameState.winnerId) return null;

  const winner = gameState.players[gameState.winnerId];

  return (
    <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="card text-center max-w-md mx-4">
        <h2 className="text-2xl font-semibold text-white mb-2">Game Over</h2>
        <p className="text-lg text-white mb-1">
          {winner?.name} wins
        </p>
        <p className="text-white/60 mb-6 text-sm">
          Final wealth: ${winner?.money.toLocaleString()}
        </p>
        <button
          onClick={() => {
            useGameStore.getState().reset();
            router.push('/');
          }}
          className="btn btn-primary"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = useGameStore(state => state.roomId);
  const gameState = useGameStore(state => state.gameState);
  const localPlayerId = useGameStore(state => state.localPlayerId);
  const isRolling = useGameStore(state => state.isRolling);
  const currentDiceRoll = gameState?.currentDiceRoll ?? null;
  const lastDiceRollId = gameState?.lastDiceRollId ?? 0;
  const lastDiceRollSeed = gameState?.lastDiceRollSeed;
  const applyDiceResult = useGameStore(state => state.applyDiceResult);

  const myPlayer = gameState && localPlayerId ? gameState.players[localPlayerId] : null;

  const handleDiceRollComplete = useCallback(
    (result: [number, number], seed: number) => {
      // Only apply and broadcast when we are the one who rolled (current player).
      // When we're the guest and Dice is just displaying the host's roll, onRollComplete
      // still fires when the display animation settles — we must not send ROLL_DICE again
      // or the host would apply it twice and move double spaces.
      const state = useGameStore.getState();
      const gs = state.gameState;
      if (!gs || gs.turnOrder.length === 0) return;
      const currentPlayerId = gs.turnOrder[gs.currentPlayerIndex];
      if (currentPlayerId !== state.localPlayerId) return;
      applyDiceResult(result, seed);
    },
    [applyDiceResult]
  );

  // Verify room matches
  useEffect(() => {
    if (!roomId || roomId !== params.roomId) {
      router.push('/');
    }
  }, [roomId, params.roomId, router]);

  // Redirect if game not in playing state
  useEffect(() => {
    if (gameState && gameState.phase === 'lobby') {
      router.push('/lobby');
    }
  }, [gameState?.phase, router]);

  if (!gameState || !myPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Header */}
      <GameHeader />

      {/* Main 3D Scene - currentDiceRoll drives dice animation for all clients */}
      <div className="absolute inset-0">
        <GameScene
          isRolling={isRolling}
          currentDiceRoll={currentDiceRoll}
          rollId={lastDiceRollId}
          diceRollSeed={lastDiceRollSeed}
          onDiceRollComplete={handleDiceRollComplete}
        />
      </div>

      {/* Left Panel - Players */}
      <div className="absolute top-20 left-4 z-10">
        <PlayerPanel />
      </div>

      {/* Right Panel - Actions */}
      <div className="absolute top-20 right-4 z-10">
        <ActionPanel />
      </div>

      {/* Property Card Modal */}
      <PropertyCard />

      {/* GO salary collected popup */}
      <GoCollectToast />

      {/* Winner Overlay */}
      <WinnerOverlay />

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-lg border border-white/20 bg-black/80 px-4 py-2">
        <p className="text-xs text-white/60">
          Drag to rotate · Scroll to zoom · Click properties for details
        </p>
      </div>
    </div>
  );
}
