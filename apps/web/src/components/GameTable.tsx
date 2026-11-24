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
import { ArrowLeft, History, Volume2, VolumeX, ListOrdered, Hand, ArrowDownUp, Plus, X, Info } from 'lucide-react';

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
    resetGame,
    isConnected,
  } = useGameSocket();

  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [showDeclareConfirm, setShowDeclareConfirm] = useState(false);
  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [showDiscardHistory, setShowDiscardHistory] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [tableScale, setTableScale] = useState(1);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [hasSorted, setHasSorted] = useState(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    setSelectedCardIds(new Set());
    setHasSorted(false);
    setShowDropConfirm(false);
    setShowDeclareConfirm(false);
    setIsActionPending(false);
  }, [publicState?.tableId, publicState?.dealNumber]);
  const [isActionPending, setIsActionPending] = useState(false);
  const [draggedCardInfo, setDraggedCardInfo] = useState<{ card: Card; sourceGroupId: string } | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [touchDragCard, setTouchDragCard] = useState<Card | null>(null);
  const [touchDragPos, setTouchDragPos] = useState<{ x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; card: Card; groupId: string; hasMoved: boolean } | null>(null);

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
      setTableScale(Math.min(window.innerWidth / 1440, window.innerHeight / 780));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const myPlayer = publicState?.players.find((p) => p.playerId === currentUser.userId);
  const opponents = publicState?.players.filter((p) => p.playerId !== currentUser.userId) || [];

  const handEnabled = isConnected && myPlayer?.status === 'ACTIVE' && (publicState?.tableStatus === 'IN_PROGRESS' || (isArrangePhase && !isWinnerOfDeal && !hasSubmittedHand));
  const animatedDraw = useRef<typeof lastDrawnCard>(null);
  useEffect(() => {
    if (!lastDrawnCard || lastDrawnCard.source !== 'CLOSED_DECK' || animatedDraw.current === lastDrawnCard || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const deck = document.querySelector('.closed-deck-back');
    const card = document.querySelector<HTMLElement>(`.table-hand [data-card-id="${CSS.escape(lastDrawnCard.card.cardId)}"]`);
    if (!deck || !card) return;
    animatedDraw.current = lastDrawnCard;
    const from = deck.getBoundingClientRect();
    const to = card.getBoundingClientRect();
    const scale = to.width / card.offsetWidth;
    if (scale > 0) card.animate([
      { transform: `translate(${(from.left - to.left) / scale}px, ${(from.top - to.top) / scale}px) rotate(-8deg)` },
      { transform: 'none' }
    ], { duration: 320, easing: 'ease-out' });
  }, [lastDrawnCard, myHand, myGroups]);

  const isMyTurn = myPlayer?.isTurn || false;
  const turnPhase = publicState?.turnPhase || 'DRAW';
  const canDraw = isConnected && publicState?.tableStatus === 'IN_PROGRESS' && myPlayer?.status === 'ACTIVE' && isMyTurn && turnPhase === 'DRAW' && !isActionPending;
  const canDiscard = isConnected && publicState?.tableStatus === 'IN_PROGRESS' && myPlayer?.status === 'ACTIVE' && isMyTurn && turnPhase === 'DISCARD' && !isActionPending;

  // Sound effect on turn alert
  useEffect(() => {
    if (isMyTurn && publicState?.tableStatus === 'IN_PROGRESS') {
      sounds.playTurnAlert();
    }
  }, [isMyTurn, publicState?.turnHistoryCount, publicState?.tableStatus]);

  // Reset action pending when state updates or error occurs
  useEffect(() => {
    setIsActionPending(false);
  }, [publicState?.revision, publicState?.turnHistoryCount, publicState?.turnPhase, errorMessage]);

  // 13/14 CARD ORPHAN SAFETY: Guaranteed visibility of every card in myHand
  const wildJoker = publicState?.wildJokerCard;
  const baseGroups = myGroups;
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

  // Card interactions
  const handleCardClick = (card: Card) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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
    suppressClickRef.current = false;
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

      if (handEnabled && hasMoved && e.type !== 'pointercancel') {
        suppressClickRef.current = true;
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
          const targetIndex = el?.closest('[data-card-index]')?.getAttribute('data-card-index');
          if (targetGid) {
            handleDropOnGroup(card.cardId, targetGid, targetIndex === null || targetIndex === undefined ? undefined : Number(targetIndex));
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
    sounds.playCardSelect();

    let updated = currentGroups;
    let destination = targetGroupId;
    for (const cardId of Array.from(selectedCardIds)) {
      updated = HandManager.moveCard(
        updated,
        cardId,
        destination,
        undefined,
        wildJoker
      );
      if (destination === 'NEW_GROUP') destination = updated.find(group => group.cards.some(card => card.cardId === cardId))?.id ?? destination;
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
    sounds.playCardSelect();

    const updated = HandManager.ungroupCards(currentGroups, selectedCardIds, publicState?.wildJokerCard);
    groupCards(updated);
    setSelectedCardIds(new Set());
  };

  const handleSortBySuit = () => {
    setHasSorted(true);
    sounds.playCardSelect();
    const suitGrouped = HandManager.sortBySuitGroups(myHand, publicState?.wildJokerCard);
    groupCards(suitGrouped);
    setSelectedCardIds(new Set());
  };

  const handleAutoGroup = () => {
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
    sounds.playCardSelect();
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

  const cardDisplaySize = 'lg' as const;

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

  const mySeatIndex = myPlayer?.seatIndex ?? 0;
  const remainingSec = publicState.turnExpiresAt
    ? Math.max(0, Math.ceil((publicState.turnExpiresAt - now) / 1000)) : 0;
  const entryAmount = activeTableConfig?.entryAmount ?? 100;
  const variantLabel = publicState.variant === 'POINTS' ? 'Points Rummy'
    : publicState.variant === 'POOL_101' ? '101 Pool'
    : publicState.variant === 'POOL_201' ? '201 Pool' : '240 Pool';
  const canDrop = isConnected && myPlayer?.status === 'ACTIVE' && publicState.tableStatus === 'IN_PROGRESS' && !isActionPending;
  const isFirstDrop = (myPlayer?.turnsPlayed ?? 0) === 0 && !myPlayer?.hasDrawnInCurrentTurn;
  const dropPenalty = isFirstDrop ? (activeTableConfig?.firstDropPenalty ?? 20) : (activeTableConfig?.middleDropPenalty ?? 40);
  const handWidth = currentGroups.reduce((width, group) => width + 114 + Math.max(0, group.cards.length - 1) * 38, 0) + currentGroups.length * 12 + 44;
  const handScale = Math.min(1, 1190 / handWidth);
  const tableStatus = !isConnected ? 'Reconnecting to table…'
    : isArrangePhase ? `${declarationInfo?.winnerUsername ?? 'A player'} declared. Arrange your cards · ${arrangeRemainingSec}s`
    : myPlayer?.status === 'DROPPED' ? 'Waiting for the next deal'
    : isActionPending ? 'Processing…'
    : isMyTurn ? (turnPhase === 'DRAW' ? 'Your turn · Pick a card' : 'Your turn · Discard or show')
    : publicState.tableStatus === 'IN_PROGRESS' ? "Opponent’s turn" : 'Deal completed';
  const positionFor = (opponent: PlayerPublicInfo): React.CSSProperties => {
    if (publicState.players.length <= 2) return { left: '50%', top: 110 };
    const relative = (opponent.seatIndex - mySeatIndex + 6) % 6;
    const positions = [{left: '50%', top: 110}, {left: '10%', top: 183},
      {left: '28%', top: 110}, {left: '50%', top: 105},
      {left: '72%', top: 110}, {left: '90%', top: 183}];
    return positions[relative];
  };
  const seat = (player: PlayerPublicInfo, self = false) => (
    <PlayerSeat player={{...player, turnRemainingSec: remainingSec}}
      isSelf={self} isDealer={player.seatIndex === publicState.dealerSeatIndex}
      totalTurnDurationSec={activeTableConfig?.turnDurationSec ?? 30}
      hasTossWin={tossPhaseActive && tossWinnerSeat === player.seatIndex}
      hasJustDrawn={opponentDrawEvent?.playerId === player.playerId ? {source: opponentDrawEvent.source} : null} />
  );

  return (
    <div className="rummy-game" aria-label="Rummy game table">
      <div className="rummy-canvas" style={{transform: `translate(-50%, -50%) scale(${tableScale})`}}>
        <header className="rummy-header">
          <button className="table-icon" aria-label="Leave table" onClick={() => setShowLeaveConfirm(true)}><ArrowLeft /></button>
          <div className="table-heading">
            <strong>{variantLabel} <span>·</span> {entryAmount.toLocaleString('en-IN')} chips</strong>
            <small>Deal {publicState.dealNumber} · #{publicState.tableId.slice(-9)}</small>
          </div>
          <div className="table-tools">
            <span className={`connection-indicator ${isConnected ? 'online' : ''}`}>{isConnected ? 'Connected' : 'Reconnecting'}</span>
            <button className="table-icon" onClick={toggleScoreboard} aria-label="Open scoreboard"><ListOrdered /></button>
            <button className="table-icon" onClick={() => {sounds.setMuted(!isMuted); setIsMuted(!isMuted);}} aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}>{isMuted ? <VolumeX /> : <Volume2 />}</button>
            <a className="table-icon" href="/rules" target="_blank" rel="noopener noreferrer" aria-label="Game rules"><Info /></a>
          </div>
        </header>
        <p className="table-turn-status" role="status">{tableStatus}</p>
        <div className="rummy-felt" aria-hidden="true"><span>RUMMY ROYALE</span></div>
        {opponents.map(opponent => <div key={opponent.playerId} className="table-opponent" style={positionFor(opponent)}>{seat(opponent)}</div>)}
        <div className="table-decks">
          <button className="closed-deck" onClick={() => handleDrawAction('CLOSED_DECK')} disabled={!canDraw} aria-label="Draw from closed deck">
            {publicState.wildJokerCard && <span className="wild-joker"><PlayingCard card={publicState.wildJokerCard} size="lg" /></span>}
            <span className="closed-deck-back"><CardBack width={90} height={126} colorTheme="red" /></span>
          </button>
          <button className={`open-deck ${dragOverZone === 'DISCARD' ? 'drop-highlight' : ''}`} aria-label="Open discard pile: draw or discard selected card"
            data-drop-zone="discard" onClick={() => canDiscard && selectedCardIds.size === 1 ? handleDiscardClick() : handleDrawAction('OPEN_DISCARD')}
            onDragOver={event => handleCardDragOverZone(event, 'DISCARD')} onDrop={event => {event.preventDefault(); handleDropOnDiscard(event.dataTransfer.getData('text/plain'));}}>
            {topDiscardCard ? <PlayingCard card={topDiscardCard} size="lg" /> : <span>Empty</span>}
          </button>
          <button className={`show-slot ${dragOverZone === 'FINISH' ? 'drop-highlight' : ''}`} data-drop-zone="finish" aria-label="Show hand"
            onDragOver={event => handleCardDragOverZone(event, 'FINISH')} onDrop={event => {event.preventDefault(); handleDropOnFinish(event.dataTransfer.getData('text/plain'));}}
            onClick={() => {if (canDiscard && selectedCardIds.size === 1) setShowDeclareConfirm(true); else if (canDiscard) setErrorMessage('Select the card you want to finish with.');}}>
            SHOW<br />HERE
          </button>
        </div>
        {tossPhaseActive && <div className="table-toss" role="status">Re-seating players after toss</div>}
        <button className="table-history table-icon" aria-label="View discard history" onClick={() => setShowDiscardHistory(!showDiscardHistory)}><History /></button>
        {handEnabled && <div className="hand-controls">
          <div className="flex gap-3">
            {!hasSorted && <button onClick={handleSortBySuit}><ArrowDownUp size={18} aria-hidden="true" />Sort</button>}
            {!hasSorted && <button onClick={handleAutoGroup}>Auto group</button>}
          </div>
          <div className="flex gap-3">
            {selectedCardIds.size >= 2 && <button onClick={handleGroupSelected}>Group</button>}
            {selectedCardIds.size >= 2 && <button onClick={handleUngroup}>Ungroup</button>}
            {selectedCardIds.size === 1 && <><button className="action-discard" disabled={!canDiscard} onClick={handleDiscardClick}>Discard</button><button className="action-declare" disabled={!canDiscard} onClick={() => setShowDeclareConfirm(true)}>Declare</button></>}
            {isArrangePhase && !isWinnerOfDeal && myPlayer?.status === 'ACTIVE' && <button disabled={hasSubmittedHand} onClick={() => submitArrangedHand(currentGroups)}>{hasSubmittedHand ? 'Hand submitted' : `Submit hand · ${arrangeRemainingSec}s`}</button>}
          </div>
        </div>}
        <div ref={element => { if (element) element.inert = !handEnabled; }} className={`table-hand ${myPlayer?.status === 'DROPPED' ? 'hand-dropped' : ''}`} aria-label="Your cards" style={{transform: `scale(${handScale})`, transformOrigin: 'center bottom'}}>
          {currentGroups.map(group => <CardGroupView key={group.id} group={group} selectedCardIds={selectedCardIds} wildJokerCard={publicState.wildJokerCard}
            newlyPickedCardId={lastDrawnCard?.card.cardId} draggedCardId={touchDragCard?.cardId} isDragOverTarget={dragOverZone === group.id}
            onCardClick={handleCardClick} onCardPointerDown={handleCardPointerDown}
            size="xl" />)}
          <button className={`new-group-zone ${dragOverZone === 'NEW_GROUP' ? 'drop-highlight' : ''}`} data-drop-zone="new-group"
            aria-label="Move selected cards to a new group" onClick={() => handleMoveSelectedToGroup('NEW_GROUP')}><Plus size={24} /></button>
        </div>
        {myPlayer?.status === 'DROPPED' && <div className="table-dropped-message" role="status"><Hand size={30} /><span>You’ve dropped from this deal and {myPlayer.dealScore} pts will be added to your score. Please wait for the next deal.</span></div>}
        <div className="table-self">{myPlayer && seat(myPlayer, true)}</div>
        {canDrop && <button className="table-drop-button" onClick={() => setShowDropConfirm(true)}><Hand size={25} />Drop</button>}
        <button className="table-game-chip" onClick={toggleScoreboard}><span>{myPlayer?.status === 'DROPPED' ? 'Dropped' : myPlayer?.status === 'ELIMINATED' ? 'Eliminated' : `${myHand.length} cards`}</span><small>{variantLabel} · {entryAmount} chips</small></button>
        {errorMessage && <div className="table-error" role="alert"><span>{errorMessage}</span><button onClick={clearError} aria-label="Dismiss error"><X size={20} /></button></div>}
        {showDiscardHistory && <section className="table-history-panel" aria-label="Discard history"><header><strong>Discard history</strong><button className="table-icon" onClick={() => setShowDiscardHistory(false)} aria-label="Close discard history"><X /></button></header><div className="flex gap-3 overflow-x-auto">{publicState.openDiscardPile.map(card => <PlayingCard key={card.cardId} card={card} size="md" />)}</div></section>}
      </div>
      <div className="portrait-table-hint">For a larger table, turn your phone sideways.</div>
      {showLeaveConfirm && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="leave-title"><div className="table-dialog"><h2 id="leave-title">Leave this table?</h2><p>Play and turn timers continue while you’re away. Choose Return to table in the lobby to take your seat again.</p><div className="flex gap-3"><button onClick={() => setShowLeaveConfirm(false)}>Keep playing</button><button onClick={() => {resetGame(); window.location.assign('/');}}>Go to lobby</button></div></div></div>}

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
      {handEnabled && touchDragCard && touchDragPos && (
        <div
          style={{
            position: 'fixed',
            left: `${touchDragPos.x - 45 * tableScale}px`,
            top: `${touchDragPos.y - 63 * tableScale}px`,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: `scale(${tableScale * 0.82}) rotate(2deg)`,
            transformOrigin: 'top left',
            opacity: 0.8,
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))',
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
