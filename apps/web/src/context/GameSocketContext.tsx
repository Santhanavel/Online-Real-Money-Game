'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Card,
  CardGroup,
  DealResult,
  DeclarationInfo,
  DeclarationResultPayload,
  GameFinalResult,
  GameVariant,
  MatchmakingStatusPayload,
  MatchmakingTableUpdatedPayload,
  MatchmakingTicket,
  MatchmakingUiState,
  PublicGameState,
  TableConfig,
  RevealedPlayerHand,
  PoolScoreboardPayload,
  PoolSplitRequest,
  NextDealCountdownPayload,
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
  matchmakingUiState: MatchmakingUiState;
  matchmakingTicket: MatchmakingTicket | null;
  waitingTable: MatchmakingTableUpdatedPayload | null;
  matchmakingMessage: string | null;
  matchmakingCountdown: number | null;
  resumableTableId: string | null;
  returnToTable: () => void;
  activeTableId: string | null;
  activeTableConfig: TableConfig | null;
  lastDealResult: DealResult | null;
  gameFinalResult: GameFinalResult | null;
  lastDrawnCard: DrawnCardInfo | null;
  opponentDrawEvent: OpponentDrawInfo | null;
  declarationInfo: DeclarationInfo | null;
  declarationResult: DeclarationResultPayload | null;
  hasSubmittedHand: boolean;
  revealedHands: RevealedPlayerHand[] | null;
  scoreboard: PoolScoreboardPayload | null;
  splitRequest: PoolSplitRequest | null;
  countdownTick: NextDealCountdownPayload | null;
  requestSplit: () => void;
  voteSplit: (accept: boolean) => void;
  requestReentry: () => void;
  isScoreboardOpen: boolean;
  isScoreboardMinimized: boolean;
  openScoreboard: () => void;
  closeScoreboard: () => void;
  toggleScoreboard: () => void;
  setIsScoreboardMinimized: (val: boolean) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  clearError: () => void;
  joinMatchmaking: (variant: GameVariant, entryAmount: number, maxPlayers: 2 | 6, pointValue?: number) => void;
  leaveMatchmaking: () => void;
  cancelMatchmaking: () => void;
  dismissMatchmakingModal: () => void;
  drawCard: (source: 'CLOSED_DECK' | 'OPEN_DISCARD') => void;
  discardCard: (cardId: string) => void;
  dropDeal: () => void;
  declareHand: (finishCardId: string, groups: { cards: Card[] }[]) => void;
  submitArrangedHand: (groups: CardGroup[]) => void;
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
  const [matchmakingUiState, setMatchmakingUiState] = useState<MatchmakingUiState>('IDLE');
  const [matchmakingTicket, setMatchmakingTicket] = useState<MatchmakingTicket | null>(null);
  const [waitingTable, setWaitingTable] = useState<MatchmakingTableUpdatedPayload | null>(null);
  const [matchmakingMessage, setMatchmakingMessage] = useState<string | null>(null);
  const [matchmakingCountdown, setMatchmakingCountdown] = useState<number | null>(null);

  const [resumableTableId, setResumableTableId] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeTableConfig, setActiveTableConfig] = useState<TableConfig | null>(null);
  const [lastDealResult, setLastDealResult] = useState<DealResult | null>(null);
  const [gameFinalResult, setGameFinalResult] = useState<GameFinalResult | null>(null);
  const [lastDrawnCard, setLastDrawnCard] = useState<DrawnCardInfo | null>(null);
  const [opponentDrawEvent, setOpponentDrawEvent] = useState<OpponentDrawInfo | null>(null);
  const [declarationInfo, setDeclarationInfo] = useState<DeclarationInfo | null>(null);
  const [declarationResult, setDeclarationResult] = useState<DeclarationResultPayload | null>(null);
  const [hasSubmittedHand, setHasSubmittedHand] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [isScoreboardMinimized, setIsScoreboardMinimized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pool Lifecycle & Split states
  const [revealedHands, setRevealedHands] = useState<RevealedPlayerHand[] | null>(null);
  const [scoreboard, setScoreboard] = useState<PoolScoreboardPayload | null>(null);
  const [splitRequest, setSplitRequest] = useState<PoolSplitRequest | null>(null);
  const [countdownTick, setCountdownTick] = useState<NextDealCountdownPayload | null>(null);

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
        userId: `guest-${Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')}`,
        username: `Player_${randNum}`,
      };
      try {
        localStorage.setItem('rummy_player_profile', JSON.stringify(user));
      } catch {}
    }

    setCurrentUser(user);

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin;
    const keyName = `rummy_guest_key:${user.userId}`;
    const guestKey = localStorage.getItem(keyName) || Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(keyName, guestKey);
    const s = io(serverUrl, {
      addTrailingSlash: !!process.env.NEXT_PUBLIC_SERVER_URL,
      auth: {
        token: localStorage.getItem('rummy_token'),
        guestKey,
        playerId: user.userId,
        username: user.username,
      },
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      setIsConnected(true);
      const savedTableId = sessionStorage.getItem('rummy_active_table');
      const routeTableId = window.location.pathname.startsWith('/game/') ? window.location.pathname.split('/')[2] : null;
      if (savedTableId || routeTableId) {
        s.emit('game:reconnect', { tableId: savedTableId ?? routeTableId });
      } else {
        // Only reconnect matchmaking if explicitly initiated in this browser session
        const wasInMatchmaking = typeof window !== 'undefined' && sessionStorage.getItem('rummy_in_matchmaking') === 'true';
        if (wasInMatchmaking) {
          s.emit('matchmaking:reconnect');
        } else {
          s.emit('game:discover');
        }
      }
    });

    s.on('matchmaking:reservation_available', () => {
      sessionStorage.setItem('rummy_in_matchmaking', 'true');
      s.emit('matchmaking:reconnect');
    });

    s.on('game:seat_transferred', () => {
      sessionStorage.removeItem('rummy_active_table');
      window.location.replace('/');
    });

    s.on('game:resume_available', ({ tableId }: { tableId: string | null }) => {
      if (tableId && sessionStorage.getItem('rummy_in_matchmaking') === 'true') {
        s.emit('game:reconnect', { tableId });
        return;
      }
      setResumableTableId(tableId);
    });

    s.on('game:session_missing', () => {
      setResumableTableId(null);
      sessionStorage.removeItem('rummy_active_table');
      s.emit('game:discover');
      sessionStorage.removeItem('rummy_in_matchmaking');
      setActiveTableId(null);
      setActiveTableConfig(null);
      setPublicState(null);
      if (window.location.pathname.startsWith('/game/')) window.location.assign('/');
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // --- Authoritative Matchmaking Socket Listeners ---
    s.on('matchmaking:status', (payload: MatchmakingStatusPayload) => {
      const wasInMatchmaking = typeof window !== 'undefined' && sessionStorage.getItem('rummy_in_matchmaking') === 'true';
      // If client didn't actively request matchmaking in this session, do not show searching modal
      if (!wasInMatchmaking && ['SEARCHING', 'PLAYERS_JOINING'].includes(payload.state)) {
        s.emit('matchmaking:leave');
        setIsSearching(false);
        setMatchmakingUiState('IDLE');
        return;
      }

      setMatchmakingUiState(payload.state);
      if (payload.ticket) setMatchmakingTicket(payload.ticket);
      if (payload.table) setWaitingTable(payload.table);
      if (payload.message) setMatchmakingMessage(payload.message);
      if (payload.countdownSec !== undefined) setMatchmakingCountdown(payload.countdownSec);

      if (['SEARCHING', 'PLAYERS_JOINING', 'MATCH_FOUND', 'START_COUNTDOWN', 'PREPARING'].includes(payload.state)) {
        setIsSearching(true);
      } else if (payload.state === 'STARTED') {
        if (typeof window !== 'undefined') sessionStorage.removeItem('rummy_in_matchmaking');
        setTimeout(() => setIsSearching(false), 800);
      } else if (['IDLE', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(payload.state)) {
        if (typeof window !== 'undefined') sessionStorage.removeItem('rummy_in_matchmaking');
        setIsSearching(false);
        setMatchmakingUiState('IDLE');
      }
    });

    s.on('matchmaking:table_updated', (tablePayload: MatchmakingTableUpdatedPayload) => {
      setWaitingTable(tablePayload);
      setMatchmakingUiState((prev) => {
        if (prev === 'SEARCHING' || prev === 'PLAYERS_JOINING') {
          return tablePayload.occupiedSeatCount >= tablePayload.tableCapacity ? 'MATCH_FOUND' : 'PLAYERS_JOINING';
        }
        return prev;
      });
    });

    // Real-Time Table Events (Requirement 12)
    const handleRealtimeTableEvent = (eventData: any) => {
      if (eventData?.seats) {
        setWaitingTable((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            seats: eventData.seats,
            occupiedSeatCount: eventData.occupiedSeatCount ?? prev.occupiedSeatCount,
            tableStatus: eventData.currentTableState ?? prev.tableStatus,
            gameStartsAt: eventData.applicableDeadline ?? prev.gameStartsAt,
            countdownSec: eventData.countdownSec ?? prev.countdownSec,
          };
        });
      }
      if (eventData?.countdownSec !== undefined) {
        setMatchmakingCountdown(eventData.countdownSec);
      }
      if (eventData?.message) {
        setMatchmakingMessage(eventData.message);
      }
    };

    s.on('TABLE_PLAYER_JOINED', handleRealtimeTableEvent);
    s.on('TABLE_PLAYER_LEFT', handleRealtimeTableEvent);
    s.on('TABLE_CAPACITY_UPDATED', handleRealtimeTableEvent);
    s.on('TABLE_FULL', (data: any) => {
      setMatchmakingUiState('MATCH_FOUND');
      handleRealtimeTableEvent(data);
    });
    s.on('START_COUNTDOWN_STARTED', (data: any) => {
      setMatchmakingUiState('START_COUNTDOWN');
      handleRealtimeTableEvent(data);
    });
    s.on('START_COUNTDOWN_UPDATED', handleRealtimeTableEvent);
    s.on('START_COUNTDOWN_CANCELLED', (data: any) => {
      setMatchmakingUiState('PLAYERS_JOINING');
      handleRealtimeTableEvent(data);
    });
    s.on('TABLE_EXPIRED', (data: any) => {
      setMatchmakingUiState('EXPIRED');
      handleRealtimeTableEvent(data);
    });

    s.on('matchmaking:started', (data: { tableId: string; config: TableConfig }) => {
      setMatchmakingUiState('STARTED');
      setActiveTableId(data.tableId);
      setActiveTableConfig(data.config);
      setTimeout(() => {
        setIsSearching(false);
      }, 600);
    });

    s.on('table:joined', (data: { tableId: string; config: TableConfig }) => {
      setResumableTableId(null);
      sessionStorage.setItem('rummy_active_table', data.tableId);
      sessionStorage.removeItem('rummy_in_matchmaking');
      setIsSearching(false);
      setMatchmakingUiState('IDLE');
      setActiveTableId(data.tableId);
      setActiveTableConfig(data.config);
      setLastDealResult(null);
      setGameFinalResult(null);
      setDeclarationInfo(null);
      setDeclarationResult(null);
      setHasSubmittedHand(false);
      setIsScoreboardOpen(false);
      setIsScoreboardMinimized(false);
      setLastDrawnCard(null);
    });

    s.on('game:state', (state: PublicGameState) => {
      setPublicState(state);
      setHasSubmittedHand(!!state.players.find(p => p.playerId === user.userId)?.hasSubmittedHand);
      if (state.declarationInfo) {
        setDeclarationInfo(state.declarationInfo);
      }
    });

    s.on('game:my_hand', (data: { myHand: Card[]; myGroups: CardGroup[] }) => {
      setMyHand(data.myHand);
      setMyGroups(data.myGroups || []);
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

    s.on('game:hand_declared_arrange', (info: DeclarationInfo) => {
      setDeclarationInfo(info);
    });

    s.on('game:declaration_result', (result: DeclarationResultPayload) => {
      setDeclarationResult(result);
    });

    s.on('game:hand_submitted', () => {
      setHasSubmittedHand(true);
    });

    s.on('game:deal_ended', (data: { dealResult: DealResult; nextRoundStartsAt?: number }) => {
      setLastDealResult(data.dealResult);
      setDeclarationInfo(null);
      setIsScoreboardOpen(true);
      setIsScoreboardMinimized(false);
    });

    s.on('deal:hands_revealed', (data: { hands: RevealedPlayerHand[] }) => {
      setRevealedHands(data.hands);
    });

    s.on('scoreboard:updated', (data: PoolScoreboardPayload) => {
      setScoreboard(data);
    });

    s.on('split:requested', (data: PoolSplitRequest) => {
      setSplitRequest(data);
    });

    s.on('split:vote_updated', (data: PoolSplitRequest) => {
      setSplitRequest(data);
    });

    s.on('split:completed', (data: PoolSplitRequest) => {
      setSplitRequest(data);
    });

    s.on('split:declined', () => {
      setSplitRequest(null);
      setErrorMessage('Prize split proposal was declined.');
    });

    s.on('split:expired', () => {
      setSplitRequest(null);
    });

    s.on('deal:countdown_tick', (data: NextDealCountdownPayload) => {
      setCountdownTick(data);
    });

    s.on('deal:countdown_paused', () => {
      setCountdownTick((prev) => (prev ? { ...prev, isPaused: true } : null));
    });

    s.on('deal:started', () => {
      setLastDealResult(null);
      setRevealedHands(null);
      setSplitRequest(null);
      setCountdownTick(null);
      setIsScoreboardOpen(false);
      setIsScoreboardMinimized(false);
      setDeclarationInfo(null);
      setDeclarationResult(null);
      setHasSubmittedHand(false);
    });

    s.on('game:player_reentered', (data: { playerId: string; newScore: number }) => {
      setErrorMessage(`Player re-entered with ${data.newScore} points.`);
    });

    s.on('game:completed', (data: { dealResult: DealResult; finalResult?: GameFinalResult }) => {
      setLastDealResult(data.dealResult);
      setDeclarationInfo(null);
      if (data.finalResult) {
        setGameFinalResult(data.finalResult);
      }
      setIsScoreboardOpen(true);
      setIsScoreboardMinimized(false);
    });

    s.on('error:action_rejected', (data: { action?: string; message: string }) => {
      let friendlyMsg = data.message;
      if (data.action === 'drop') {
        friendlyMsg = `Cannot Drop: ${data.message}`;
      } else if (data.action === 'declare') {
        friendlyMsg = `Cannot Declare: ${data.message}`;
      }
      setErrorMessage(friendlyMsg);
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

  // Periodic heartbeat while matchmaking ticket is active
  useEffect(() => {
    if (!socket || !matchmakingTicket || !isSearching) return;
    if (!['QUEUED', 'RESERVED'].includes(matchmakingTicket.ticketStatus)) return;

    const interval = setInterval(() => {
      socket.emit('matchmaking:heartbeat', { ticketId: matchmakingTicket.ticketId });
    }, 15000);

    return () => clearInterval(interval);
  }, [socket, matchmakingTicket, isSearching]);

  const joinMatchmaking = (
    variant: GameVariant,
    entryAmount: number,
    maxPlayers: 2 | 6,
    pointValue?: number
  ) => {
    if (!socket) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('rummy_in_matchmaking', 'true');
    }
    const pv = pointValue !== undefined ? pointValue : entryAmount / 80;
    setIsSearching(true);
    setMatchmakingUiState('SEARCHING');
    setMatchmakingMessage('Finding your table...');
    setWaitingTable(null);
    setLastDealResult(null);
    setGameFinalResult(null);
    setIsScoreboardOpen(false);
    setIsScoreboardMinimized(false);
    socket.emit('matchmaking:join', { variant, entryAmount, pointValue: pv, maxPlayers });
  };

  const cancelMatchmaking = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('rummy_in_matchmaking');
    }
    if (socket) {
      socket.emit('matchmaking:cancel', { ticketId: matchmakingTicket?.ticketId });
    }
    setIsSearching(false);
    setMatchmakingUiState('IDLE');
    setMatchmakingMessage(null);
    setWaitingTable(null);
    setMatchmakingTicket(null);
  };

  const leaveMatchmaking = () => {
    cancelMatchmaking();
  };

  const dismissMatchmakingModal = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('rummy_in_matchmaking');
    }
    if (socket) {
      socket.emit('matchmaking:leave');
    }
    setIsSearching(false);
    setMatchmakingUiState('IDLE');
    setWaitingTable(null);
    setMatchmakingTicket(null);
  };

  const drawCard = (source: 'CLOSED_DECK' | 'OPEN_DISCARD') => {
    if (!socket?.connected || !activeTableId) return;
    socket.emit('game:draw', { tableId: activeTableId, source });
  };

  const discardCard = (cardId: string) => {
    if (!socket?.connected || !activeTableId) return;
    socket.emit('game:discard', { tableId: activeTableId, cardId });
  };

  const dropDeal = () => {
    if (!socket?.connected || !activeTableId) return;
    socket.emit('game:drop', { tableId: activeTableId });
  };

  const declareHand = (finishCardId: string, groups: { cards: Card[] }[]) => {
    if (!socket?.connected || !activeTableId) return;
    socket.emit('game:declare', { tableId: activeTableId, finishCardId, groups });
  };

  const submitArrangedHand = (groups: CardGroup[]) => {
    if (!socket?.connected || !activeTableId) return;
    socket.emit('game:submit_arranged_hand', { tableId: activeTableId, groups });
    setHasSubmittedHand(true);
  };

  const groupCards = (groups: CardGroup[]) => {
    setMyGroups(groups);
    if (!socket?.connected || !activeTableId) return;
    socket.emit('game:group_cards', { tableId: activeTableId, groups });
  };

  const requestSplit = () => {
    if (!socket?.connected || !activeTableId) return;
    socket.emit('split:request', { tableId: activeTableId });
  };

  const voteSplit = (accept: boolean) => {
    if (!socket?.connected || !activeTableId) return;
    socket.emit('split:vote', { tableId: activeTableId, accept });
  };

  const requestReentry = () => {
    if (!socket?.connected || !activeTableId) return;
    socket.emit('pool:reentry', { tableId: activeTableId });
  };

  const resetGame = () => {
    sessionStorage.removeItem('rummy_active_table');
    sessionStorage.removeItem('rummy_in_matchmaking');
    setActiveTableId(null);
    setActiveTableConfig(null);
    setPublicState(null);
    setMyHand([]);
    setMyGroups([]);
    setLastDealResult(null);
    setGameFinalResult(null);
    setDeclarationInfo(null);
    setDeclarationResult(null);
    setHasSubmittedHand(false);
    setIsScoreboardOpen(false);
    setIsScoreboardMinimized(false);
    setLastDrawnCard(null);
    setRevealedHands(null);
    setScoreboard(null);
    setSplitRequest(null);
    setCountdownTick(null);
  };

  const clearError = () => {
    setErrorMessage(null);
    setDeclarationResult(null);
  };

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
        matchmakingUiState,
        matchmakingTicket,
        waitingTable,
        matchmakingMessage,
        matchmakingCountdown,
        resumableTableId,
        returnToTable: () => { if (resumableTableId) socket?.emit('game:reconnect', { tableId: resumableTableId }); },
        activeTableId,
        activeTableConfig,
        lastDealResult,
        gameFinalResult,
        lastDrawnCard,
        opponentDrawEvent,
        declarationInfo,
        declarationResult,
        hasSubmittedHand,
        revealedHands,
        scoreboard,
        splitRequest,
        countdownTick,
        requestSplit,
        voteSplit,
        requestReentry,
        isScoreboardOpen,
        isScoreboardMinimized,
        openScoreboard,
        closeScoreboard,
        toggleScoreboard,
        setIsScoreboardMinimized,
        errorMessage,
        setErrorMessage,
        clearError,
        joinMatchmaking,
        leaveMatchmaking,
        cancelMatchmaking,
        dismissMatchmakingModal,
        drawCard,
        discardCard,
        dropDeal,
        declareHand,
        submitArrangedHand,
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
