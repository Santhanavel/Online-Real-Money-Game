'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardGroup, PlayerPublicInfo } from '@rummy/shared-types';
import { CardBack, CardGroupView, PlayingCard } from '@rummy/card-assets';
import { DeclarationValidator, HandManager, ScoringEngine } from '@rummy/game-engine';
import { useGameSocket } from '../context/GameSocketContext';
import { PlayerSeat } from './PlayerSeat';
import { ResultModal } from './ResultModal';
import { InvalidDeclarationModal } from './InvalidDeclarationModal';
import { sounds } from '../utils/soundEffects';

export const GameTable: React.FC = () => {
  const {
    publicState,
    myHand,
    myGroups,
    currentUser,
    lastDrawnCard,
    opponentDrawEvent,
    declarationInfo,
    declarationResult,
    lastDealResult,
    activeTableConfig,
    hasSubmittedHand,
    toggleScoreboard,
    drawCard,
    discardCard,
    dropDeal,
    declareHand,
    submitArrangedHand,
    groupCards,
    errorMessage,
    setErrorMessage,
    clearError,
  } = useGameSocket();

  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [showDeclareConfirm, setShowDeclareConfirm] = useState(false);
  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [showDiscardHistory, setShowDiscardHistory] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [draggedCardInfo, setDraggedCardInfo] = useState<{ card: Card; sourceGroupId: string } | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [touchDragCard, setTouchDragCard] = useState<Card | null>(null);
  const [touchDragPos, setTouchDragPos] = useState<{ x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; card: Card; groupId: string; hasMoved: boolean } | null>(null);

  // Arrangement Undo History Stack
  const [undoHistory, setUndoHistory] = useState<CardGroup[][]>([]);

  // Toss Phase State (Deal 1 start sequence matching RummyCulture Sheet 0)
  const [tossPhaseActive, setTossPhaseActive] = useState<boolean>(false);
  const [tossWinnerSeat, setTossWinnerSeat] = useState<number | null>(null);

  useEffect(() => {
    if (publicState?.dealNumber === 1 && publicState?.turnHistoryCount === 0 && publicState?.tableStatus === 'IN_PROGRESS') {
      const dealerSeat = publicState.dealerSeatIndex ?? 0;
      setTossWinnerSeat(dealerSeat);
      setTossPhaseActive(true);
      const timer = setTimeout(() => {
        setTossPhaseActive(false);
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [publicState?.dealNumber, publicState?.turnHistoryCount, publicState?.tableStatus]);

  // 15s Arrange Cards Phase State
  const isArrangePhase = publicState?.tableStatus === 'ARRANGE_HAND';
  const isWinnerOfDeal =
    declarationInfo?.winnerPlayerId === currentUser.userId ||
    publicState?.players.find((p) => p.playerId === currentUser.userId)?.status === 'DECLARED';

  const [arrangeRemainingSec, setArrangeRemainingSec] = useState<number>(15);

  useEffect(() => {
    if (!isArrangePhase || !declarationInfo?.arrangeExpiresAt) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((declarationInfo.arrangeExpiresAt - Date.now()) / 1000));
      setArrangeRemainingSec(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [isArrangePhase, declarationInfo?.arrangeExpiresAt]);

  // Responsive screen detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const myPlayer = publicState?.players.find((p) => p.playerId === currentUser.userId);
  const opponents = publicState?.players.filter((p) => p.playerId !== currentUser.userId) || [];

  const isMyTurn = myPlayer?.isTurn || false;
  const turnPhase = publicState?.turnPhase || 'DRAW';
  const canDraw = isMyTurn && turnPhase === 'DRAW' && !isActionPending;
  const canDiscard = isMyTurn && turnPhase === 'DISCARD' && !isActionPending;

  // Sound effect on turn alert
  useEffect(() => {
    if (isMyTurn && publicState?.tableStatus === 'IN_PROGRESS') {
      sounds.playTurnAlert();
    }
  }, [isMyTurn, publicState?.turnHistoryCount, publicState?.tableStatus]);

  // Reset action pending when state updates or error occurs
  useEffect(() => {
    setIsActionPending(false);
  }, [publicState?.turnHistoryCount, publicState?.turnPhase, errorMessage]);

  // 13/14 CARD ORPHAN SAFETY: Guaranteed visibility of every card in myHand
  const wildJoker = publicState?.wildJokerCard;
  const baseGroups = myGroups.length > 0
    ? myGroups
    : (wildJoker ? HandManager.autoGroupCards(myHand, wildJoker) : []);
  const groupedCardIds = new Set(baseGroups.flatMap((g) => g.cards.map((c) => c.cardId)));
  const orphanCards = myHand.filter((c) => !groupedCardIds.has(c.cardId));

  const currentGroups = orphanCards.length > 0
    ? [
        ...baseGroups,
        {
          id: `grp-drawn-orphan-${orphanCards[0]?.cardId || Date.now()}`,
          cards: orphanCards,
          meldType: 'INVALID' as const,
          isValid: false,
        },
      ]
    : baseGroups;

  const liveHandScore = wildJoker
    ? ScoringEngine.calculateHandScore(currentGroups, wildJoker, false)
    : 0;

  const pushToUndo = () => {
    setUndoHistory((prev) => [...prev.slice(-15), currentGroups]);
  };

  // Card interactions
  const handleCardClick = (card: Card) => {
    sounds.playCardSelect();
    const next = new Set(selectedCardIds);
    if (next.has(card.cardId)) {
      next.delete(card.cardId);
    } else {
      next.add(card.cardId);
    }
    setSelectedCardIds(next);
  };

  const handleCardDragStart = (e: React.DragEvent, card: Card, groupId: string) => {
    setDraggedCardInfo({ card, sourceGroupId: groupId });
    e.dataTransfer.setData('text/plain', card.cardId);
    e.dataTransfer.setData('application/json', JSON.stringify({ cardId: card.cardId, sourceGroupId: groupId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCardDragOverZone = (e: React.DragEvent, zone: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverZone !== zone) {
      setDragOverZone(zone);
    }
  };

  const handleDropOnDiscard = (cardId: string) => {
    if (!canDiscard) {
      sounds.playInvalidAction();
      clearError();
      return;
    }
    setIsActionPending(true);
    sounds.playCardDiscard();
    discardCard(cardId);
    setSelectedCardIds(new Set());
    setDraggedCardInfo(null);
    setDragOverZone(null);
    setTouchDragCard(null);
    setTouchDragPos(null);
  };

  const handleDropOnFinish = (cardId: string) => {
    if (!canDiscard) {
      sounds.playInvalidAction();
      clearError();
      return;
    }
    setSelectedCardIds(new Set([cardId]));
    setShowDeclareConfirm(true);
    setDraggedCardInfo(null);
    setDragOverZone(null);
    setTouchDragCard(null);
    setTouchDragPos(null);
  };

  const handleDropOnNewGroup = (cardId: string) => {
    pushToUndo();
    sounds.playCardSelect();
    const updated = HandManager.moveCard(
      currentGroups,
      cardId,
      'NEW_GROUP',
      undefined,
      wildJoker
    );
    groupCards(updated);
    setDraggedCardInfo(null);
    setDragOverZone(null);
    setTouchDragCard(null);
    setTouchDragPos(null);
  };

  const handleDropOnGroup = (cardId: string, targetGroupId: string, targetIndex?: number) => {
    pushToUndo();
    sounds.playCardSelect();
    const updated = HandManager.moveCard(
      currentGroups,
      cardId,
      targetGroupId,
      targetIndex,
      wildJoker
    );
    groupCards(updated);
    setDraggedCardInfo(null);
    setDragOverZone(null);
    setTouchDragCard(null);
    setTouchDragPos(null);
  };

  const handleCardPointerDown = (e: React.PointerEvent, card: Card, groupId: string) => {
    if (e.button !== 0) return;
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      card,
      groupId,
      hasMoved: false,
    };
  };

  // Global Pointer Events for smooth touch/pointer dragging across slots
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!pointerStartRef.current) return;
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 8 || pointerStartRef.current.hasMoved) {
        pointerStartRef.current.hasMoved = true;
        setTouchDragCard(pointerStartRef.current.card);
        setTouchDragPos({ x: e.clientX, y: e.clientY });
        setDraggedCardInfo({
          card: pointerStartRef.current.card,
          sourceGroupId: pointerStartRef.current.groupId,
        });

        // Detect hover element under finger/pointer
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const dropZoneEl = el?.closest('[data-drop-zone]');
        const zoneType = dropZoneEl?.getAttribute('data-drop-zone');

        if (zoneType === 'discard') {
          setDragOverZone('DISCARD');
        } else if (zoneType === 'finish') {
          setDragOverZone('FINISH');
        } else if (zoneType === 'new-group') {
          setDragOverZone('NEW_GROUP');
        } else if (zoneType === 'group') {
          const gid = dropZoneEl?.getAttribute('data-group-id');
          setDragOverZone(gid || null);
        } else {
          setDragOverZone(null);
        }
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (!pointerStartRef.current) return;
      const { card, groupId, hasMoved } = pointerStartRef.current;
      pointerStartRef.current = null;

      if (hasMoved) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const dropZoneEl = el?.closest('[data-drop-zone]');
        const zoneType = dropZoneEl?.getAttribute('data-drop-zone');

        if (zoneType === 'discard') {
          handleDropOnDiscard(card.cardId);
        } else if (zoneType === 'finish') {
          handleDropOnFinish(card.cardId);
        } else if (zoneType === 'new-group') {
          handleDropOnNewGroup(card.cardId);
        } else if (zoneType === 'group') {
          const targetGid = dropZoneEl?.getAttribute('data-group-id');
          if (targetGid && targetGid !== groupId) {
            handleDropOnGroup(card.cardId, targetGid);
          }
        }
      }

      setTouchDragCard(null);
      setTouchDragPos(null);
      setDraggedCardInfo(null);
      setDragOverZone(null);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [canDiscard, currentGroups, wildJoker]);

  const handleMoveSelectedToGroup = (targetGroupId: string) => {
    if (selectedCardIds.size === 0) return;
    pushToUndo();
    sounds.playCardSelect();

    let updated = currentGroups;
    for (const cardId of Array.from(selectedCardIds)) {
      updated = HandManager.moveCard(
        updated,
        cardId,
        targetGroupId,
        undefined,
        wildJoker
      );
    }
    groupCards(updated);
    setSelectedCardIds(new Set());
  };

  // Safe loading view when publicState is synchronizing
  if (!publicState) {
    return (
      <div className="w-full h-screen bg-[#111414] flex flex-col items-center justify-center text-white select-none">
        <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
          <span className="absolute text-2xl">♠</span>
        </div>
        <h2 className="text-lg font-black text-amber-200 tracking-wider uppercase mb-1">
          Loading Game Table...
        </h2>
        <span className="text-xs text-amber-100/60 font-semibold">
          Synchronizing authoritative table session
        </span>
      </div>
    );
  }

  const handleGroupSelected = () => {
    if (selectedCardIds.size < 2) return;
    pushToUndo();
    sounds.playCardSelect();

    const selectedCards = myHand.filter((c) => selectedCardIds.has(c.cardId));
    const unselectedCards = myHand.filter((c) => !selectedCardIds.has(c.cardId));

    const newGroup: CardGroup = {
      id: `grp-${Date.now()}`,
      cards: selectedCards,
    };

    const remainingGroups: CardGroup[] = [];
    for (const g of currentGroups) {
      const filtered = g.cards.filter((c) => !selectedCardIds.has(c.cardId));
      if (filtered.length > 0) {
        remainingGroups.push({ ...g, cards: filtered });
      }
    }

    if (unselectedCards.length > 0 && remainingGroups.length === 0) {
      remainingGroups.push({
        id: `grp-rem-${Date.now()}`,
        cards: unselectedCards,
      });
    }

    const updatedGroups = [newGroup, ...remainingGroups].map((g) => {
      const evalRes = ScoringEngine.calculateHandScore([g], publicState?.wildJokerCard, false);
      return {
        ...g,
        meldType: g.cards.length >= 3 ? (evalRes.hasPureSequence ? 'PURE_SEQUENCE' as const : evalRes.hasSecondSequence ? 'IMPURE_SEQUENCE' as const : 'INVALID' as const) : 'INVALID' as const,
        isValid: evalRes.penaltyPoints === 0,
      };
    });

    groupCards(updatedGroups);
    setSelectedCardIds(new Set());
  };

  const handleUngroup = () => {
    if (selectedCardIds.size === 0) return;
    pushToUndo();
    sounds.playCardSelect();

    const updated = HandManager.ungroupCards(currentGroups, selectedCardIds, publicState?.wildJokerCard);
    groupCards(updated);
    setSelectedCardIds(new Set());
  };

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    sounds.playCardSelect();

    const previous = undoHistory[undoHistory.length - 1];
    setUndoHistory((prev) => prev.slice(0, prev.length - 1));
    groupCards(previous);
    setSelectedCardIds(new Set());
  };

  const handleSortBySuit = () => {
    pushToUndo();
    sounds.playCardSelect();
    const suitGrouped = HandManager.sortBySuitGroups(myHand, publicState?.wildJokerCard);
    groupCards(suitGrouped);
    setSelectedCardIds(new Set());
  };

  const handleAutoGroup = () => {
    pushToUndo();
    sounds.playCardSelect();
    const autoGrouped = HandManager.autoGroupCards(myHand, publicState?.wildJokerCard);
    groupCards(autoGrouped);
    setSelectedCardIds(new Set());
  };

  const handleDiscardClick = () => {
    if (!canDiscard || selectedCardIds.size !== 1) return;
    const cardId = Array.from(selectedCardIds)[0];
    setIsActionPending(true);
    sounds.playCardDiscard();
    discardCard(cardId);
    setSelectedCardIds(new Set());
  };

  const handleDeclareSubmit = () => {
    if (!canDiscard || selectedCardIds.size !== 1) return;
    const finishCardId = Array.from(selectedCardIds)[0];

    const declaredGroups = currentGroups
      .map((g) => ({
        cards: g.cards.filter((c) => c.cardId !== finishCardId),
      }))
      .filter((g) => g.cards.length > 0);

    setIsActionPending(true);
    sounds.playVictoryFanfare();
    declareHand(finishCardId, declaredGroups);
    setShowDeclareConfirm(false);
    setSelectedCardIds(new Set());
  };

  const handleDrawAction = (source: 'CLOSED_DECK' | 'OPEN_DISCARD') => {
    if (!canDraw || isActionPending) return;
    setIsActionPending(true);
    sounds.playCardDraw();
    drawCard(source);
  };

  const cardDisplaySize = isMobile ? 'sm' : 'md';

  // Connecting / Loading fallback if socket snapshot is still arriving
  if (!publicState) {
    return (
      <div className="w-full min-h-[calc(100vh-56px)] flex items-center justify-center bg-[#0a0b0f] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-amber-200">Connecting to game table...</span>
        </div>
      </div>
    );
  }

  const topDiscardCard =
    publicState.openDiscardPile && publicState.openDiscardPile.length > 0
      ? publicState.openDiscardPile[publicState.openDiscardPile.length - 1]
      : null;

  // Seating Positions Calculation for 2P vs 6P (Top Arc matching RummyCulture Video)
  const mySeatIndex = myPlayer?.seatIndex || 0;
  const is6Player = (publicState.players?.length ?? 0) > 2;

  const getOpponentPositionClass = (opp: PlayerPublicInfo, index: number) => {
    if (!is6Player) {
      // 2-Player: Top Center directly opposite
      return 'top-2 sm:top-3 left-1/2 -translate-x-1/2';
    }

    // 6-Player: 5 opponents distributed cleanly along the top oval arc
    const relativeSeat = (opp.seatIndex - mySeatIndex + 6) % 6;
    switch (relativeSeat) {
      case 1:
        return 'left-[6%] sm:left-[8%] top-[12%] sm:top-[14%]'; // Far Top-Left
      case 2:
        return 'left-[24%] sm:left-[26%] top-[3%] sm:top-[4%]';  // Mid Top-Left
      case 3:
        return 'left-1/2 -translate-x-1/2 top-[1.5%] sm:top-[2%]'; // Center Top
      case 4:
        return 'right-[24%] sm:right-[26%] top-[3%] sm:top-[4%]'; // Mid Top-Right
      case 5:
        return 'right-[6%] sm:right-[8%] top-[12%] sm:top-[14%]'; // Far Top-Right
      default:
        const positions = [
          'left-[6%] top-[12%]',
          'left-[24%] top-[3%]',
          'left-1/2 -translate-x-1/2 top-[2%]',
          'right-[24%] top-[3%]',
          'right-[6%] top-[12%]',
        ];
        return positions[index % positions.length];
    }
  };

  const tableIdShort = publicState?.tableId ? `#${publicState.tableId.slice(-7)}` : '#1603163';
  const entryFeeValue = (activeTableConfig as any)?.entryFee || (activeTableConfig as any)?.entryAmount || 100;

  return (
    <div className="relative w-full min-h-[calc(100vh-56px)] flex flex-col justify-between p-1.5 sm:p-2 select-none overflow-hidden bg-[#0a0b0f] bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,#181b24_0%,#08090d_100%)] bg-[size:44px_100%]">
      {/* 1. TOP HEADER INFO BAR matching RummyCulture Video */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-300 px-3 py-1.5 z-20 bg-black/50 border-b border-amber-500/25 rounded-b-xl">
        {/* Left: LEAVE Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.href = '/'}
            className="px-2.5 py-1 rounded-md border border-white/30 hover:border-white text-white/85 hover:text-white font-extrabold text-[11px] tracking-wider transition bg-black/40 flex items-center gap-1 cursor-pointer"
            title="Leave Table"
          >
            <span>LEAVE</span>
            <span>←</span>
          </button>
        </div>

        {/* Center: Table Capsule (#Table_ID | Format | Stake) */}
        <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/75 border border-amber-500/35 text-[11px] sm:text-xs font-black shadow-inner">
          <span className="text-emerald-400 font-mono">{tableIdShort}</span>
          <span className="text-amber-500/60">•</span>
          <span className="text-amber-100">
            {publicState.variant === 'POINTS'
              ? 'Points Rummy'
              : publicState.variant === 'POOL_240' || (publicState.variant as string) === 'POINTS_240'
              ? 'Pool 240'
              : publicState.variant === 'POOL_101'
              ? 'Pool 101'
              : 'Pool 201'}
          </span>
          <span className="text-amber-500/60">•</span>
          <span className="text-amber-300 font-extrabold">🪙 {entryFeeValue}</span>
          <span className="text-amber-500/60">•</span>
          <span className="text-slate-300">
            Deal {publicState.tableStatus === 'DEAL_OVER' && lastDealResult ? lastDealResult.dealNumber : publicState.dealNumber}
          </span>
        </div>

        {/* Dynamic Contextual Turn Status */}
        <div className="hidden md:flex items-center">
          {publicState.tableStatus === 'ARRANGE_HAND' ? (
            isWinnerOfDeal ? (
              <span className="text-amber-300 text-xs font-bold">
                🏆 Valid Show Accepted ({arrangeRemainingSec}s)
              </span>
            ) : (
              <span className="text-rose-300 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <span>⚠️ {declarationInfo?.winnerUsername || 'Opponent'} declared!</span>
                <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-black text-[10px]">
                  {arrangeRemainingSec}s
                </span>
              </span>
            )
          ) : publicState.tableStatus === 'IN_PROGRESS' ? (
            isMyTurn ? (
              canDraw ? (
                <span className="text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Pick from Closed or Open Deck
                </span>
              ) : isActionPending ? (
                <span className="text-amber-300 text-xs font-bold animate-pulse">Processing...</span>
              ) : (
                <span className="text-amber-300 text-xs font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                  Select 1 card to Discard or Declare
                </span>
              )
            ) : (
              <span className="text-slate-400 text-xs font-medium">Opponent's turn</span>
            )
          ) : (
            <span className="text-amber-300 text-xs font-bold">Deal Completed</span>
          )}
        </div>

        {/* Right Tools: Scoreboard, Sound, Info (i), Settings (⚙) matching RummyCulture Video */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleScoreboard}
            className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 px-2.5 py-0.5 rounded-full font-bold text-[11px] transition shadow-sm cursor-pointer"
          >
            <span>📊</span>
            <span className="hidden sm:inline">Scoreboard</span>
          </button>
          <button
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              sounds.setMuted(next);
            }}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black border border-slate-700 text-slate-300 flex items-center justify-center text-xs transition cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => window.open('/rules', '_blank')}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black border border-slate-700 text-amber-200 font-bold flex items-center justify-center text-xs transition cursor-pointer"
            title="How to Play / Rules"
          >
            ⓘ
          </button>
          <button
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black border border-slate-700 text-slate-300 flex items-center justify-center text-xs transition cursor-pointer"
            title="Table Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Error Alert Toast */}
      {errorMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-4 py-1.5 rounded-full font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce border border-rose-400">
          <span>⚠️ {errorMessage}</span>
          <button onClick={clearError} className="font-black text-sm">✕</button>
        </div>
      )}

      {/* 2. RUMMYCULTURE CASINO STADIUM FELT TABLE (Fixed Horizontal Landscape Layout - Issue 9) */}
      <div className="w-full flex-1 flex items-center justify-center overflow-x-auto overflow-y-hidden py-1">
        <div className="relative w-full max-w-6xl min-w-[740px] sm:min-w-[860px] md:min-w-[960px] min-h-[500px] sm:min-h-[530px] rounded-[70px] sm:rounded-[120px] md:rounded-[150px] bg-[radial-gradient(ellipse_at_center,_#166a39_0%,_#0f4c27_50%,_#083119_80%,_#03190c_100%)] border-[8px] sm:border-[12px] border-[#7a4c16] shadow-[inset_0_0_100px_rgba(0,0,0,0.85),_0_0_0_3px_rgba(240,185,50,0.5),_0_25px_60px_rgba(0,0,0,0.95)] flex flex-col justify-between p-2 sm:p-3 relative overflow-hidden select-none">
          {/* Golden Inset Ring */}
          <div className="absolute inset-2 sm:inset-3 rounded-[60px] sm:rounded-[110px] md:rounded-[140px] border border-amber-400/25 pointer-events-none" />

          {/* OPPONENTS DISTRIBUTED ACROSS STADIUM TOP RIM (Clearance from center decks - Issue 1) */}
          {opponents.map((opp, idx) => (
            <div key={opp.playerId} className={`absolute z-25 ${getOpponentPositionClass(opp, idx)}`}>
              <PlayerSeat
                player={opp}
                isSelf={false}
                hasTossWin={tossPhaseActive && tossWinnerSeat === opp.seatIndex}
                hasJustDrawn={opponentDrawEvent?.playerId === opp.playerId ? { source: opponentDrawEvent.source } : null}
              />
            </div>
          ))}

          {/* Toss Phase Announcement matching RummyCulture Sheet 0 */}
          {tossPhaseActive && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-35 bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 px-6 py-2.5 rounded-full font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-bounce">
              <span>✓</span>
              <span>Re-seating players after toss</span>
            </div>
          )}

          {/* 3. CENTRAL GAME AREA: Positioned with ample vertical clearance below top player row */}
          <div className="relative flex items-center justify-center gap-6 sm:gap-8 md:gap-10 mt-24 sm:mt-28 mb-3 z-15">
          {/* A. Wild Joker Tucked Horizontally Under Closed Deck Stack */}
          <div
            onClick={() => handleDrawAction('CLOSED_DECK')}
            className="relative flex items-center select-none cursor-pointer group/deck"
            title="Closed Deck (Click to draw)"
          >
            {/* Horizontal Wild Joker Card (Rotated -90deg, peeking to the left) */}
            {publicState.wildJokerCard && (
              <div
                className="relative z-10 transition-transform duration-200 group-hover/deck:-translate-x-1"
                style={{
                  transform: 'rotate(-90deg)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))',
                }}
              >
                <PlayingCard
                  card={publicState.wildJokerCard}
                  isWildJoker={false}
                  size={cardDisplaySize}
                />
              </div>
            )}

            {/* Vertical Closed Deck Stack (Red Card Back with 'R' monogram) */}
            <div
              className="relative z-20 transition-transform duration-200 group-hover/deck:scale-105"
              style={{
                marginLeft: publicState.wildJokerCard ? (isMobile ? '-32px' : '-42px') : '0',
                filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.7))',
              }}
            >
              {/* Stack depth cards */}
              <div className="absolute -top-1 -right-0.5 w-full h-full rounded-xl bg-[#52040c] border border-amber-500/20" />
              <div className="relative rounded-xl overflow-hidden shadow-2xl">
                <CardBack width={isMobile ? 54 : 72} height={isMobile ? 76 : 102} colorTheme="red" />
              </div>
            </div>
          </div>

          {/* B. Open Discard Pile (Clean face-up card, natural shadow) */}
          <div
            data-drop-zone="discard"
            onDragOver={(e) => handleCardDragOverZone(e, 'DISCARD')}
            onDragLeave={() => setDragOverZone((prev) => (prev === 'DISCARD' ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              const cardId = draggedCardInfo?.card.cardId || e.dataTransfer.getData('text/plain');
              if (cardId) handleDropOnDiscard(cardId);
            }}
            onClick={() => topDiscardCard && handleDrawAction('OPEN_DISCARD')}
            className={`relative z-15 transition-transform duration-200 select-none ${
              dragOverZone === 'DISCARD'
                ? 'scale-105 ring-4 ring-rose-500 rounded-xl shadow-[0_0_25px_rgba(244,63,94,0.7)]'
                : 'cursor-pointer hover:scale-105'
            }`}
            style={{
              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
            }}
            title="Open Discard Pile (Click to draw, or drag a card here to discard)"
          >
            {topDiscardCard ? (
              <PlayingCard card={topDiscardCard} size={cardDisplaySize} />
            ) : (
              <div
                style={{ width: isMobile ? 54 : 72, height: isMobile ? 76 : 102 }}
                className="rounded-xl border-2 border-dashed border-white/25 bg-black/30 flex items-center justify-center text-xs text-white/40"
              >
                Empty
              </div>
            )}
            {dragOverZone === 'DISCARD' && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-rose-950/90 rounded-xl font-black text-[10px] text-white tracking-wider animate-pulse border-2 border-rose-400 text-center px-1 pointer-events-none">
                <span className="text-sm">⬇</span>
                <span>DISCARD</span>
              </div>
            )}
          </div>

          {/* C. Dedicated "Show Here" Slot (RummyCulture exact styling) */}
          <div
            data-drop-zone="finish"
            onDragOver={(e) => handleCardDragOverZone(e, 'FINISH')}
            onDragLeave={() => setDragOverZone((prev) => (prev === 'FINISH' ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              const cardId = draggedCardInfo?.card.cardId || e.dataTransfer.getData('text/plain');
              if (cardId) handleDropOnFinish(cardId);
            }}
            onClick={() => {
              if (canDiscard && selectedCardIds.size === 1) {
                setShowDeclareConfirm(true);
              } else if (canDiscard) {
                setErrorMessage('Select 1 card or drag a card here to declare');
              }
            }}
            style={{ width: isMobile ? 54 : 72, height: isMobile ? 76 : 102 }}
            className={`relative z-15 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center text-center p-1 select-none cursor-pointer ${
              dragOverZone === 'FINISH'
                ? 'border-amber-300 bg-amber-500/35 ring-4 ring-amber-400 scale-105 shadow-[0_0_35px_rgba(245,158,11,0.85)]'
                : canDiscard
                ? 'border-dashed border-amber-400/80 bg-black/65 shadow-xl hover:border-amber-300 hover:scale-102'
                : 'border-dashed border-white/20 bg-black/50 opacity-80'
            }`}
            title="Drag a 14th card here to Declare / Show"
          >
            {dragOverZone === 'FINISH' ? (
              <div className="flex flex-col items-center animate-pulse pointer-events-none">
                <span className="text-xl">🏆</span>
                <span className="text-[9px] font-black text-amber-200 uppercase mt-0.5 leading-tight">
                  SHOW HERE
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center pointer-events-none">
                <span className="text-[12px] sm:text-[13px] font-black text-white/80 uppercase tracking-wider leading-snug">
                  Show
                </span>
                <span className="text-[12px] sm:text-[13px] font-black text-white/80 uppercase tracking-wider leading-snug">
                  Here
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Anchored Table Left Rim: Miniature Cards Icon matching RummyCulture Video */}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-30 w-8 sm:w-9 h-9 sm:h-10 rounded-r-xl bg-gradient-to-br from-[#b8860b] to-[#7a4c16] border-2 border-l-0 border-[#ffd700] text-amber-200 shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center select-none pointer-events-none">
          <span className="text-sm sm:text-base">🎴</span>
        </div>

        {/* Anchored Table Right Rim: Circular HISTORY ↺ Tab Button matching RummyCulture Video */}
        <button
          onClick={() => setShowDiscardHistory(!showDiscardHistory)}
          className="absolute -right-1 top-1/2 -translate-y-1/2 z-30 w-11 sm:w-12 h-11 sm:h-12 rounded-full bg-gradient-to-br from-[#8b1420] to-[#590a12] hover:from-[#a61928] hover:to-[#6b0d16] text-white font-black border-2 border-[#d4af37] shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center cursor-pointer select-none transition-transform hover:scale-105 active:scale-95"
          title="Toggle Discard History"
        >
          <span className="text-base sm:text-lg leading-none">↺</span>
          <span className="text-[7px] sm:text-[8px] font-extrabold uppercase tracking-tight text-amber-200 mt-0.5">HISTORY</span>
        </button>

        {/* Table Bottom Left: Circular Home 🏠 Button + Green "+ Game" Button matching RummyCulture Sheet 0 & 1 */}
        <div className="absolute left-3 sm:left-5 bottom-3 sm:bottom-4 z-30 flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => window.location.href = '/'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-b from-[#1b5e20] to-[#0d3310] hover:from-[#2e7d32] hover:to-[#1b5e20] border-2 border-[#ffd700] text-amber-300 flex items-center justify-center text-lg shadow-xl transition active:scale-95 cursor-pointer"
            title="Return to Lobby"
          >
            🏠
          </button>
          <button
            onClick={() => {}}
            className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-black text-[11px] border border-emerald-400/70 shadow-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
            title="Add Table"
          >
            <span className="font-bold">+</span>
            <span>Game</span>
          </button>
        </div>

        {/* Dropped State Overlay matching RummyCulture Video */}
        {myPlayer?.status === 'DROPPED' && (
          <div className="absolute inset-x-4 bottom-28 z-35 flex justify-center pointer-events-none animate-fade-in">
            <div className="bg-black/90 border border-red-500/70 text-red-200 px-6 py-2 rounded-full font-black text-xs sm:text-sm tracking-wide shadow-2xl flex items-center gap-2">
              <span>🏳️</span>
              <span>You have dropped from the game.</span>
            </div>
          </div>
        )}

        {/* Previous Discards Drawer Tray */}
        {showDiscardHistory && (
          <div className="absolute inset-x-4 sm:inset-x-12 bottom-24 z-40 bg-slate-950/95 backdrop-blur-md rounded-2xl p-3 border border-amber-500/40 shadow-2xl flex flex-col items-center animate-fade-in">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                Discard History ({publicState.openDiscardPile.length} cards)
              </span>
              <button
                onClick={() => setShowDiscardHistory(false)}
                className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
              {publicState.openDiscardPile.slice(-6).map((card) => (
                <PlayingCard key={card.cardId} card={card} size="sm" />
              ))}
            </div>
          </div>
        )}

        {/* 4. PLAYER HAND DIRECTLY ON THE FELT TABLE (Exact RummyCulture Match) */}
        <div className="relative w-full flex flex-col items-center z-25 mt-auto pb-1">
          {/* Subtle Floating Controls (RummyCulture: simple Sort pill, Group when cards selected, Submit during Arrange) */}
          <div className="w-full flex items-center justify-between px-4 sm:px-8 mb-1 pointer-events-auto">
            {/* Left: Clean SORT pill matching RummyCulture */}
            <button
              onClick={handleSortBySuit}
              className="px-3.5 py-1 rounded-full bg-gradient-to-r from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 text-white font-black text-xs border border-emerald-400/60 shadow-lg transition active:scale-95 cursor-pointer uppercase tracking-wider"
              title="Sort cards into suit groups"
            >
              Sort
            </button>

            {/* Center/Right: Contextual Actions (GROUP when 2+ cards selected, DISCARD when 1 card selected, or SUBMIT during arrange) */}
            <div className="flex items-center gap-2">
              {isArrangePhase ? (
                isWinnerOfDeal ? (
                  <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 font-extrabold text-xs">
                    🏆 Winner ({arrangeRemainingSec}s)
                  </div>
                ) : (
                  <button
                    onClick={() => submitArrangedHand(currentGroups)}
                    disabled={hasSubmittedHand}
                    className={`px-4 py-1 rounded-full font-black text-xs shadow-lg transition active:scale-95 cursor-pointer ${
                      hasSubmittedHand
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
                        : 'bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 border border-emerald-300 animate-pulse'
                    }`}
                  >
                    {hasSubmittedHand ? '✓ Hand Submitted' : 'Submit Hand'}
                  </button>
                )
              ) : (
                <>
                  {selectedCardIds.size >= 2 && (
                    <button
                      onClick={handleGroupSelected}
                      disabled={isActionPending}
                      className="px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs border border-amber-300 shadow-xl transition active:scale-95 cursor-pointer uppercase tracking-wider animate-bounce"
                      title="Group selected cards"
                    >
                      Group ({selectedCardIds.size})
                    </button>
                  )}
                  {canDiscard && selectedCardIds.size === 1 && (
                    <button
                      onClick={handleDiscardClick}
                      className="px-4 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs border border-rose-300 shadow-xl transition active:scale-95 cursor-pointer uppercase tracking-wider"
                    >
                      Discard
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 5. 13 CARDS DIRECTLY SITTING ON THE GREEN FELT IN COMPACT GROUPS */}
          <div className="w-full flex flex-nowrap gap-2.5 sm:gap-4 justify-center items-end py-1 max-w-full overflow-x-auto overflow-y-hidden touch-manipulation z-20">
            {currentGroups.map((group) => {
              return (
                <CardGroupView
                  key={group.id}
                  group={group}
                  selectedCardIds={selectedCardIds}
                  wildJokerCard={publicState.wildJokerCard}
                  newlyPickedCardId={lastDrawnCard?.card.cardId}
                  draggedCardId={draggedCardInfo?.card.cardId || touchDragCard?.cardId}
                  isDragOverTarget={dragOverZone === group.id}
                  onCardClick={handleCardClick}
                  onCardDragStart={handleCardDragStart}
                  onCardDragOver={(e: React.DragEvent, gid: string) => handleCardDragOverZone(e, gid)}
                  onCardDrop={(e: React.DragEvent, targetGid: string, targetIdx?: number) => {
                    const cid = draggedCardInfo?.card.cardId || e.dataTransfer.getData('text/plain');
                    if (cid) handleDropOnGroup(cid, targetGid, targetIdx);
                  }}
                  onCardPointerDown={handleCardPointerDown}
                  onMoveSelectedHere={handleMoveSelectedToGroup}
                  size={cardDisplaySize}
                />
              );
            })}
          </div>

          {/* CURRENT PLAYER SEAT (Sakshi 4800) CENTERED ON BOTTOM RIM WITH DEALER (D) */}
          {myPlayer && (
            <div className="relative z-30 mt-1 flex items-center gap-2">
              <PlayerSeat
                player={myPlayer}
                isSelf={true}
                hasTossWin={tossPhaseActive && tossWinnerSeat === myPlayer.seatIndex}
                hasJustDrawn={null}
              />
              {/* Dealer 'D' / Quick Drop button next to avatar */}
              {canDraw && (
                <button
                  onClick={() => setShowDropConfirm(true)}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300 text-slate-950 font-black text-[9px] flex flex-col items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
                  title="Drop Deal"
                >
                  <span>(D)</span>
                  <span className="text-[7px] -mt-1 font-extrabold uppercase">DROP</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Declare Confirmation Modal */}
      {showDeclareConfirm && (() => {
        const previewFinishCardId = selectedCardIds.size === 1 ? Array.from(selectedCardIds)[0] : null;
        const previewDeclaredGroups = previewFinishCardId
          ? currentGroups
              .map((g) => ({
                cards: g.cards.filter((c) => c.cardId !== previewFinishCardId),
              }))
              .filter((g) => g.cards.length > 0)
          : [];
        const previewValResult = previewFinishCardId
          ? DeclarationValidator.validateDeclaration(previewDeclaredGroups, publicState.wildJokerCard)
          : null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-fade-in">
            <div className="bg-[#0e351d] border-2 border-emerald-400/60 rounded-2xl p-5 sm:p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
              <div className="text-3xl mb-2">{previewValResult?.isValid ? '🏆' : '⚠️'}</div>
              <h3 className="text-base sm:text-lg font-black text-amber-100 mb-2">
                Are you sure you want to declare?
              </h3>

              {previewValResult?.isValid ? (
                <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-xl p-2.5 mb-4 text-xs text-emerald-200">
                  <span>✓ Valid Show (0 pts) • Pure Sequence Verified</span>
                </div>
              ) : (
                <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-2.5 mb-4 text-xs text-rose-300">
                  <span>⚠️ {previewValResult?.reason || 'Pure Sequence required'}</span>
                </div>
              )}

              <div className="flex w-full gap-3">
                <button
                  onClick={handleDeclareSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition active:scale-95 cursor-pointer"
                >
                  YES
                </button>
                <button
                  onClick={() => setShowDeclareConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-wider shadow transition active:scale-95 cursor-pointer"
                >
                  NO
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Drop Confirmation Modal */}
      {showDropConfirm && (() => {
        const isFirstDrop = ((myPlayer as any)?.turnsPlayed ?? 0) === 0 && !(myPlayer as any)?.hasDrawnInCurrentTurn;
        const dropPenalty = isFirstDrop ? 20 : 40;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="bg-slate-900 border-2 border-red-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
              <div className="text-4xl mb-2">🏳️</div>
              <h3 className="text-xl font-black text-red-300 mb-2">Drop from Deal?</h3>
              <div className="bg-red-950/60 border border-red-500/30 rounded-xl p-3 mb-4 text-left text-xs text-red-200 space-y-1">
                <div className="flex items-center justify-between font-black">
                  <span>Classification:</span>
                  <span className="text-amber-300">{isFirstDrop ? 'First Drop' : 'Middle Drop'}</span>
                </div>
                <div className="flex items-center justify-between font-black">
                  <span>Deal Penalty:</span>
                  <span className="text-rose-300">+{dropPenalty} points</span>
                </div>
                <p className="text-[11px] text-red-300/80 pt-1 border-t border-red-500/20">
                  You will forfeit this deal immediately. Your opponents will continue the game.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDropConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition"
                >
                  Keep Playing
                </button>
                <button
                  onClick={() => {
                    dropDeal();
                    setShowDropConfirm(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg shadow-red-600/30 transition active:scale-95"
                >
                  Confirm Drop (+{dropPenalty} pts)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Card Drag Preview for Touch & Drag Gestures */}
      {touchDragCard && touchDragPos && (
        <div
          style={{
            position: 'fixed',
            left: `${touchDragPos.x - (isMobile ? 27 : 36)}px`,
            top: `${touchDragPos.y - (isMobile ? 38 : 51)}px`,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: 'scale(1.08) rotate(3deg)',
            filter: 'drop-shadow(0 20px 25px rgba(0,0,0,0.75))',
          }}
          className="transition-transform duration-75 select-none"
        >
          <PlayingCard
            card={touchDragCard}
            size={cardDisplaySize}
            isWildJoker={
              publicState.wildJokerCard !== null &&
              publicState.wildJokerCard !== undefined &&
              !touchDragCard.isPrintedJoker &&
              (publicState.wildJokerCard.isPrintedJoker ? touchDragCard.rank === 'A' : touchDragCard.rank === publicState.wildJokerCard.rank)
            }
          />
        </div>
      )}

      {/* Invalid Declaration Feedback Modal (Issue 3) */}
      {declarationResult && !declarationResult.isValid && (
        <InvalidDeclarationModal
          declarationResult={declarationResult}
          onDismiss={clearError}
        />
      )}

      {/* Scoreboard Modal & Minimized Countdown Bar */}
      <ResultModal />
    </div>
  );
};
