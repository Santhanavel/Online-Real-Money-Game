'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Card,
  CardGroup,
  DealResult,
  GameFinalResult,
  GameVariant,
  PublicGameState,
  TableConfig,
} from '@rummy/shared-types';

export interface DrawnCardInfo {
  card: Card;
  source: 'CLOSED_DECK' | 'OPEN_DISCARD';
  timestamp: number;
}

export interface OpponentDrawInfo {
  playerId: string;
  source: 'CLOSED_DECK' | 'OPEN_DISCARD';
  timestamp: number;
}

interface GameSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  currentUser: { userId: string; username: string };
  setCurrentUser: (user: { userId: string; username: string }) => void;
  publicState: PublicGameState | null;
  myHand: Card[];
  myGroups: CardGroup[];
  isSearching: boolean;
  activeTableId: string | null;
  activeTableConfig: TableConfig | null;
  lastDealResult: DealResult | null;
  gameFinalResult: GameFinalResult | null;
  lastDrawnCard: DrawnCardInfo | null;
  opponentDrawEvent: OpponentDrawInfo | null;
  isScoreboardOpen: boolean;
  isScoreboardMinimized: boolean;
  openScoreboard: () => void;
  closeScoreboard: () => void;
  toggleScoreboard: () => void;
  setIsScoreboardMinimized: (val: boolean) => void;
  errorMessage: string | null;
  clearError: () => void;
  joinMatchmaking: (variant: GameVariant, pointValue: number, maxPlayers: 2 | 6) => void;
  leaveMatchmaking: () => void;
  drawCard: (source: 'CLOSED_DECK' | 'OPEN_DISCARD') => void;
  discardCard: (cardId: string) => void;
  dropDeal: () => void;
  declareHand: (finishCardId: string, groups: { cards: Card[] }[]) => void;
  groupCards: (groups: CardGroup[]) => void;
  resetGame: () => void;
}

const GameSocketContext = createContext<GameSocketContextType | null>(null);

export const GameSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState({ userId: 'usr-guest', username: 'Player' });

  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [myGroups, setMyGroups] = useState<CardGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeTableConfig, setActiveTableConfig] = useState<TableConfig | null>(null);
  const [lastDealResult, setLastDealResult] = useState<DealResult | null>(null);
  const [gameFinalResult, setGameFinalResult] = useState<GameFinalResult | null>(null);
  const [lastDrawnCard, setLastDrawnCard] = useState<DrawnCardInfo | null>(null);
  const [opponentDrawEvent, setOpponentDrawEvent] = useState<OpponentDrawInfo | null>(null);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isScoreboardMinimized, setIsScoreboardMinimized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or restore player profile on client side without SSR mismatch
  useEffect(() => {
    let user = { userId: '', username: '' };
    try {
      const stored = localStorage.getItem('rummy_player_profile');
      if (stored) {
        user = JSON.parse(stored);
      }
    } catch {}

    if (!user.userId || !user.username) {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      user = {
        userId: `usr-${randNum}`,
        username: `Player_${randNum}`,
      };
      try {
        localStorage.setItem('rummy_player_profile', JSON.stringify(user));
      } catch {}
    }

    setCurrentUser(user);

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';
    const s = io(serverUrl, {
      auth: {
        playerId: user.userId,
        username: user.username,
      },
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      setIsConnected(true);
      if (activeTableId) {
        s.emit('game:reconnect', { tableId: activeTableId });
      }
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('table:joined', (data: { tableId: string; config: TableConfig }) => {
      setIsSearching(false);
      setActiveTableId(data.tableId);
      setActiveTableConfig(data.config);
      setLastDealResult(null);
      setGameFinalResult(null);
      setIsScoreboardOpen(false);
      setIsScoreboardMinimized(false);
      setLastDrawnCard(null);
    });

    s.on('game:state', (state: PublicGameState) => {
      setPublicState(state);
    });

    s.on('game:my_hand', (data: { myHand: Card[]; myGroups: CardGroup[] }) => {
      setMyHand(data.myHand);
      if (data.myGroups && data.myGroups.length > 0) {
        setMyGroups(data.myGroups);
      }
    });

    s.on('game:card_drawn', (data: { card: Card; source: 'CLOSED_DECK' | 'OPEN_DISCARD' }) => {
      setLastDrawnCard({
        card: data.card,
        source: data.source,
        timestamp: Date.now(),
      });
      // Clear newly drawn card tag after 4 seconds
      setTimeout(() => {
        setLastDrawnCard((prev) => (prev?.card.cardId === data.card.cardId ? null : prev));
      }, 4000);
    });

    s.on('game:player_drew', (data: { playerId: string; source: 'CLOSED_DECK' | 'OPEN_DISCARD' }) => {
      setOpponentDrawEvent({
        playerId: data.playerId,
        source: data.source,
        timestamp: Date.now(),
      });
      setTimeout(() => {
        setOpponentDrawEvent(null);
      }, 1500);
    });

    s.on('game:deal_ended', (data: { dealResult: DealResult; nextRoundStartsAt?: number }) => {
      setLastDealResult(data.dealResult);
      setIsScoreboardOpen(true);
      setIsScoreboardMinimized(false);
    });

    s.on('game:completed', (data: { dealResult: DealResult; finalResult?: GameFinalResult }) => {
      setLastDealResult(data.dealResult);
      if (data.finalResult) {
        setGameFinalResult(data.finalResult);
      }
      setIsScoreboardOpen(true);
      setIsScoreboardMinimized(false);
    });

    s.on('error:action_rejected', (data: { message: string }) => {
      setErrorMessage(data.message);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const openScoreboard = () => {
    setIsScoreboardOpen(true);
    setIsScoreboardMinimized(false);
  };

  const closeScoreboard = () => {
    setIsScoreboardOpen(false);
  };

  const toggleScoreboard = () => {
    setIsScoreboardOpen((prev) => !prev);
  };

  const joinMatchmaking = (variant: GameVariant, pointValue: number, maxPlayers: 2 | 6) => {
    if (!socket) return;
    setIsSearching(true);
    setLastDealResult(null);
    setGameFinalResult(null);
    setIsScoreboardOpen(false);
    setIsScoreboardMinimized(false);
    socket.emit('matchmaking:join', { variant, pointValue, maxPlayers });
  };

  const leaveMatchmaking = () => {
    if (!socket) return;
    socket.emit('matchmaking:leave');
    setIsSearching(false);
  };

  const drawCard = (source: 'CLOSED_DECK' | 'OPEN_DISCARD') => {
    if (!socket || !activeTableId) return;
    socket.emit('game:draw', { tableId: activeTableId, source });
  };

  const discardCard = (cardId: string) => {
    if (!socket || !activeTableId) return;
    socket.emit('game:discard', { tableId: activeTableId, cardId });
  };

  const dropDeal = () => {
    if (!socket || !activeTableId) return;
    socket.emit('game:drop', { tableId: activeTableId });
  };

  const declareHand = (finishCardId: string, groups: { cards: Card[] }[]) => {
    if (!socket || !activeTableId) return;
    socket.emit('game:declare', { tableId: activeTableId, finishCardId, groups });
  };

  const groupCards = (groups: CardGroup[]) => {
    setMyGroups(groups);
    if (!socket || !activeTableId) return;
    socket.emit('game:group_cards', { tableId: activeTableId, groups });
  };

  const resetGame = () => {
    setActiveTableId(null);
    setActiveTableConfig(null);
    setPublicState(null);
    setMyHand([]);
    setMyGroups([]);
    setLastDealResult(null);
    setGameFinalResult(null);
    setIsScoreboardOpen(false);
    setIsScoreboardMinimized(false);
    setLastDrawnCard(null);
  };

  const clearError = () => setErrorMessage(null);

  return (
    <GameSocketContext.Provider
      value={{
        socket,
        isConnected,
        currentUser,
        setCurrentUser,
        publicState,
        myHand,
        myGroups,
        isSearching,
        activeTableId,
        activeTableConfig,
        lastDealResult,
        gameFinalResult,
        lastDrawnCard,
        opponentDrawEvent,
        isScoreboardOpen,
        isScoreboardMinimized,
        openScoreboard,
        closeScoreboard,
        toggleScoreboard,
        setIsScoreboardMinimized,
        errorMessage,
        clearError,
        joinMatchmaking,
        leaveMatchmaking,
        drawCard,
        discardCard,
        dropDeal,
        declareHand,
        groupCards,
        resetGame,
      }}
    >
      {children}
    </GameSocketContext.Provider>
  );
};

export const useGameSocket = () => {
  const context = useContext(GameSocketContext);
  if (!context) {
    throw new Error('useGameSocket must be used within a GameSocketProvider');
  }
  return context;
};
