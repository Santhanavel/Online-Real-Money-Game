'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardGroup } from '@rummy/shared-types';
import { CardBack, CardGroupView, PlayingCard } from '@rummy/card-assets';
import { HandManager, ScoringEngine } from '@rummy/game-engine';
import { useGameSocket } from '../context/GameSocketContext';
import { PlayerSeat } from './PlayerSeat';
import { ResultModal } from './ResultModal';
import { sounds } from '../utils/soundEffects';

export const GameTable: React.FC = () => {
  const {
    publicState,
    myHand,
    myGroups,
    currentUser,
    lastDrawnCard,
    opponentDrawEvent,
    toggleScoreboard,
    drawCard,
    discardCard,
    dropDeal,
    declareHand,
    groupCards,
    errorMessage,
    clearError,
  } = useGameSocket();

  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [showDeclareConfirm, setShowDeclareConfirm] = useState(false);
  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [showDiscardHistory, setShowDiscardHistory] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [draggedCardInfo, setDraggedCardInfo] = useState<{ card: Card; sourceGroupId: string } | null>(null);

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
  const canDraw = isMyTurn && turnPhase === 'DRAW';
  const canDiscard = isMyTurn && turnPhase === 'DISCARD';

  // Sound effect on turn alert - Hook placed before any early return!
  useEffect(() => {
    if (isMyTurn && publicState?.tableStatus === 'IN_PROGRESS') {
      sounds.playTurnAlert();
    }
  }, [isMyTurn, publicState?.turnHistoryCount, publicState?.tableStatus]);

  if (!publicState) return null;

  // Compute live hand score and meld validation
  const currentGroups = myGroups.length > 0 ? myGroups : HandManager.autoGroupCards(myHand, publicState.wildJokerCard);
  const liveHandScore = ScoringEngine.calculateHandScore(currentGroups, publicState.wildJokerCard, false);

  // Toggle card selection
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

  // Drag and drop card reordering between groups
  const handleCardDragStart = (e: React.DragEvent, card: Card, groupId: string) => {
    setDraggedCardInfo({ card, sourceGroupId: groupId });
    e.dataTransfer.setData('text/plain', card.cardId);
  };

  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCardDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    if (!draggedCardInfo) return;

    sounds.playCardSelect();
    const updated = HandManager.moveCard(
      currentGroups,
      draggedCardInfo.card.cardId,
      targetGroupId,
      undefined,
      publicState.wildJokerCard
    );
    groupCards(updated);
    setDraggedCardInfo(null);
  };

  // Group selected cards together (RummyCulture Grouping UX)
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
    for (const g of myGroups) {
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

    const updatedGroups = [newGroup, ...remainingGroups];
    const evaluated = HandManager.autoGroupCards(
      updatedGroups.flatMap((g) => g.cards),
      publicState.wildJokerCard
    );
    groupCards(evaluated);
    setSelectedCardIds(new Set());
  };

  // 1. Smart Auto-Sort Hand (Sequences & Sets)
  const handleSmartSort = () => {
    sounds.playCardSelect();
    const autoGrouped = HandManager.autoGroupCards(myHand, publicState.wildJokerCard);
    groupCards(autoGrouped);
    setSelectedCardIds(new Set());
    setShowSortMenu(false);
  };

  // 2. Sort Hand by Suit Mode
  const handleSortBySuit = () => {
    sounds.playCardSelect();
    const suitGrouped = HandManager.sortBySuitGroups(myHand, publicState.wildJokerCard);
    groupCards(suitGrouped);
    setSelectedCardIds(new Set());
    setShowSortMenu(false);
  };

  // 3. Sort Hand by Rank Mode
  const handleSortByRank = () => {
    sounds.playCardSelect();
    const rankGrouped = HandManager.sortByRankGroups(myHand, publicState.wildJokerCard);
    groupCards(rankGrouped);
    setSelectedCardIds(new Set());
    setShowSortMenu(false);
  };

  // Discard card
  const handleDiscardClick = () => {
    if (!canDiscard || selectedCardIds.size !== 1) return;
    const cardId = Array.from(selectedCardIds)[0];
    sounds.playCardDiscard();
    discardCard(cardId);
    setSelectedCardIds(new Set());
  };

  // Declare Hand Show
  const handleDeclareSubmit = () => {
    if (!canDiscard || selectedCardIds.size !== 1) return;
    const finishCardId = Array.from(selectedCardIds)[0];

    const declaredGroups = currentGroups
      .map((g) => ({
        cards: g.cards.filter((c) => c.cardId !== finishCardId),
      }))
      .filter((g) => g.cards.length > 0);

    sounds.playVictoryFanfare();
    declareHand(finishCardId, declaredGroups);
    setShowDeclareConfirm(false);
    setSelectedCardIds(new Set());
  };

  const handleDrawAction = (source: 'CLOSED_DECK' | 'OPEN_DISCARD') => {
    if (!canDraw) return;
    sounds.playCardDraw();
    drawCard(source);
  };

  const topDiscardCard =
    publicState.openDiscardPile.length > 0
      ? publicState.openDiscardPile[publicState.openDiscardPile.length - 1]
      : null;

  const cardDisplaySize = isMobile ? 'sm' : 'md';

  return (
    <div className="relative w-full min-h-[calc(100vh-60px)] flex flex-col justify-between p-2 md:p-5 select-none overflow-hidden bg-radial-gradient">
      {/* Sound toggle & Table Info floating bar */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-xs text-amber-200/90 px-2 py-1">
        <div className="flex items-center gap-2 md:gap-3">
          <span className="font-extrabold bg-slate-900/90 px-3 py-1 rounded-full border border-amber-500/30 text-amber-300 shadow-sm">
            {publicState.variant === 'POINTS' ? 'Points Rummy' : publicState.variant === 'POOL_101' ? '101 Pool Rummy' : '201 Pool Rummy'}
          </span>
          <span className="hidden sm:inline bg-black/50 px-2.5 py-1 rounded-full border border-white/5">
            Table: #{publicState.tableId.substring(0, 8)}
          </span>
          <span className="bg-black/50 px-2.5 py-1 rounded-full border border-white/5 font-semibold text-amber-200">
            Deal: {publicState.dealNumber}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Floating Scoreboard button to reopen anytime */}
          <button
            onClick={toggleScoreboard}
            className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full font-bold transition-all shadow-sm"
          >
            <span>📊</span>
            <span>Scoreboard</span>
          </button>

          <button
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              sounds.setMuted(next);
            }}
            className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 px-3 py-1 rounded-full border border-white/10 text-slate-300 transition-colors"
          >
            <span>{isMuted ? '🔇 Off' : '🔊 On'}</span>
          </button>
        </div>
      </div>

      {/* Error alert toast */}
      {errorMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-5 py-2.5 rounded-full font-bold text-xs shadow-2xl flex items-center gap-3 animate-bounce border border-rose-400">
          <span>⚠️ {errorMessage}</span>
          <button onClick={clearError} className="font-black text-sm">✕</button>
        </div>
      )}

      {/* Opponents Area (Top of table) */}
      <div className="w-full flex justify-around items-center pt-1 pb-2">
        {opponents.map((opp) => (
          <PlayerSeat
            key={opp.playerId}
            player={opp}
            isSelf={false}
            hasJustDrawn={opponentDrawEvent?.playerId === opp.playerId ? { source: opponentDrawEvent.source } : null}
          />
        ))}
      </div>

      {/* RUMMYCULTURE AUTHENTIC 3D FELT TABLE */}
      <div className="relative w-full max-w-5xl mx-auto my-2 h-[270px] md:h-[340px] rounded-[52px] md:rounded-[64px] table-felt flex items-center justify-center p-4 md:p-6 shadow-2xl border-4 border-amber-900/40">
        {/* Table Felt Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <div className="text-[110px] md:text-[160px] font-black text-amber-300 select-none">♠</div>
        </div>

        {/* Turn Status Message Banner */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-5 py-1.5 rounded-full border border-amber-400/50 text-[11px] md:text-xs font-black tracking-wide text-amber-300 shadow-xl text-center whitespace-nowrap z-20">
          {publicState.tableStatus === 'IN_PROGRESS' ? (
            isMyTurn ? (
              canDraw ? (
                <span className="text-emerald-300 animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  YOUR TURN: Draw from Closed Deck or Open Pile
                </span>
              ) : (
                <span className="text-amber-300 animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                  YOUR TURN: Select 1 card to Discard or Declare
                </span>
              )
            ) : (
              <span className="text-slate-300">
                Waiting for opponent turn...
              </span>
            )
          ) : (
            <span>Deal Over</span>
          )}
        </div>

        {/* CENTER TABLE ZONE: Closed Deck, Wild Joker, Open Discard, Finish Slot */}
        <div className="relative flex items-center gap-4 md:gap-8 z-10">
          {/* 1. Closed Deck (Stack with 3D Depth) */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-1">
              Closed ({publicState.closedDeckCount})
            </span>
            <div
              onClick={() => handleDrawAction('CLOSED_DECK')}
              className={`relative transition-all duration-200 ${
                canDraw
                  ? 'cursor-pointer hover:scale-105 ring-4 ring-emerald-400 ring-offset-2 ring-offset-emerald-950 rounded-xl shadow-2xl animate-pulse'
                  : 'opacity-95'
              }`}
            >
              {/* Layered stack 3D depth */}
              <div className="absolute -top-1.5 -left-1.5 w-[60px] md:w-[72px] h-[84px] md:h-[102px] rounded-xl bg-emerald-950 border border-amber-500/20 shadow-md" />
              <div className="absolute -top-0.5 -left-0.5 w-[60px] md:w-[72px] h-[84px] md:h-[102px] rounded-xl bg-emerald-900 border border-amber-500/30 shadow-md" />
              <div className="w-[60px] md:w-[72px] h-[84px] md:h-[102px] relative z-10 shadow-2xl">
                <CardBack width={isMobile ? 60 : 72} height={isMobile ? 84 : 102} />
              </div>
              {canDraw && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 rounded-xl font-black text-xs text-emerald-300 tracking-wider shadow-inner">
                  DRAW
                </div>
              )}
            </div>
          </div>

          {/* 2. Wild Joker Card (Slanted across deck) */}
          {publicState.wildJokerCard && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1 flex items-center gap-1">
                ★ Wild Card
              </span>
              <div className="rotate-12 shadow-2xl transition-transform hover:rotate-0">
                <PlayingCard
                  card={publicState.wildJokerCard}
                  isWildJoker={true}
                  size={cardDisplaySize}
                />
              </div>
            </div>
          )}

          {/* 3. Open Discard Pile */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-black text-amber-200 uppercase tracking-widest">
                Discard Pile
              </span>
              {publicState.openDiscardPile.length > 0 && (
                <button
                  onClick={() => setShowDiscardHistory(!showDiscardHistory)}
                  className="text-[9px] bg-black/60 hover:bg-black/90 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold"
                  title="View previous discards"
                >
                  History
                </button>
              )}
            </div>
            <div
              onClick={() => topDiscardCard && handleDrawAction('OPEN_DISCARD')}
              className={`relative transition-all duration-200 ${
                canDraw && topDiscardCard
                  ? 'cursor-pointer hover:scale-105 ring-4 ring-emerald-400 ring-offset-2 ring-offset-emerald-950 rounded-xl shadow-2xl animate-pulse'
                  : ''
              }`}
            >
              {topDiscardCard ? (
                <PlayingCard card={topDiscardCard} size={cardDisplaySize} />
              ) : (
                <div className="w-[60px] md:w-[72px] h-[84px] md:h-[102px] border-2 border-dashed border-white/20 rounded-xl flex items-center justify-center text-xs text-white/40">
                  Empty
                </div>
              )}
              {canDraw && topDiscardCard && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-xl font-black text-xs text-emerald-300">
                  DRAW
                </div>
              )}
            </div>
          </div>

          {/* 4. Dedicated Finish Slot (Signature RummyCulture Declaration Box) */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">
              Finish Slot
            </span>
            <div
              onClick={() => {
                if (canDiscard && selectedCardIds.size === 1) {
                  setShowDeclareConfirm(true);
                }
              }}
              className={`w-[60px] md:w-[72px] h-[84px] md:h-[102px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-1.5 text-center transition-all ${
                canDiscard && selectedCardIds.size === 1
                  ? 'border-amber-400 bg-amber-500/20 cursor-pointer animate-pulse shadow-lg shadow-amber-500/30'
                  : 'border-amber-500/30 bg-black/35 opacity-70'
              }`}
            >
              <span className="text-xl md:text-2xl">🏆</span>
              <span className="text-[9px] md:text-[10px] font-black text-amber-200 leading-tight mt-1 uppercase">
                Finish Show
              </span>
            </div>
          </div>
        </div>

        {/* Previous Discards Drawer Tray */}
        {showDiscardHistory && (
          <div className="absolute inset-x-4 md:inset-x-8 bottom-3 z-30 bg-slate-950/95 backdrop-blur-md rounded-2xl p-4 border border-amber-500/40 shadow-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                Recent Discard History ({publicState.openDiscardPile.length} cards)
              </span>
              <button
                onClick={() => setShowDiscardHistory(false)}
                className="text-xs font-bold text-slate-400 hover:text-white"
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
      </div>

      {/* RUMMYCULTURE 13-CARD HAND AREA & ACTION CONTROLS */}
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        {/* Live Deadwood / Hand Score Banner (Signature RummyCulture UX) */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 mb-1.5 bg-black/70 backdrop-blur-md rounded-xl border border-white/10 text-xs">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-slate-400">Hand Deadwood:</span>
            <span
              className={`text-xs md:text-sm font-black px-2.5 py-0.5 rounded-md ${
                liveHandScore.penaltyPoints === 0
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40 animate-pulse'
                  : 'bg-rose-950 text-rose-300 border border-rose-500/40'
              }`}
            >
              {liveHandScore.penaltyPoints} pts
            </span>
            <span className="text-[11px] md:text-xs text-slate-300 font-medium hidden sm:inline">
              {liveHandScore.notes}
            </span>
          </div>

          <div className="text-[11px] text-amber-300 font-bold">
            {myHand.length} cards held • {selectedCardIds.size} selected
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="w-full flex flex-wrap items-center justify-between px-1 mb-2 gap-2 relative">
          {/* Drop Button (Left) */}
          <button
            onClick={() => setShowDropConfirm(true)}
            disabled={!isMyTurn || publicState.tableStatus !== 'IN_PROGRESS'}
            className="px-3.5 md:px-5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-black text-xs disabled:opacity-40 transition-all shadow-md active:scale-95"
          >
            Drop Deal
          </button>

          {/* Group & Multi-Mode Sorting Controls (Center) */}
          <div className="flex items-center gap-2 relative">
            <button
              onClick={handleGroupSelected}
              disabled={selectedCardIds.size < 2}
              className="px-4 md:px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs disabled:opacity-30 transition-all shadow-md active:scale-95"
            >
              Group ({selectedCardIds.size})
            </button>

            {/* Sort Menu Controller */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="px-4 md:px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 border border-emerald-400/40 text-emerald-100 font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <span>⚡ Sort Hand</span>
                <span className="text-[10px]">▼</span>
              </button>

              {showSortMenu && (
                <div className="absolute bottom-full mb-2 left-0 z-40 bg-slate-900/95 border border-amber-400/40 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1 w-48 backdrop-blur-md">
                  <button
                    onClick={handleSmartSort}
                    className="text-left px-3 py-2 rounded-xl hover:bg-emerald-800/60 text-xs font-bold text-emerald-200 flex items-center justify-between transition-colors"
                  >
                    <span>Smart Sequences & Sets</span>
                    <span className="text-amber-400">★</span>
                  </button>
                  <button
                    onClick={handleSortBySuit}
                    className="text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-xs font-bold text-slate-200 flex items-center justify-between transition-colors"
                  >
                    <span>Sort by Suit (♥♦♣♠)</span>
                  </button>
                  <button
                    onClick={handleSortByRank}
                    className="text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-xs font-bold text-slate-200 flex items-center justify-between transition-colors"
                  >
                    <span>Sort by Rank (A-K)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Discard & Declare Show Buttons (Right) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardClick}
              disabled={!canDiscard || selectedCardIds.size !== 1}
              className="px-4 md:px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs disabled:opacity-35 transition-all shadow-md active:scale-95"
            >
              Discard
            </button>
            <button
              onClick={() => setShowDeclareConfirm(true)}
              disabled={!canDiscard || selectedCardIds.size !== 1}
              className={`px-4 md:px-6 py-2 rounded-xl font-black text-xs transition-all shadow-lg active:scale-95 ${
                liveHandScore.penaltyPoints === 0 && canDiscard
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 shadow-amber-500/50 animate-bounce'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 disabled:opacity-35'
              }`}
            >
              Declare Show
            </button>
          </div>
        </div>

        {/* 13-Card Groups Cascading Container */}
        <div className="w-full bg-slate-950/85 backdrop-blur-md rounded-3xl p-3 border border-amber-500/30 shadow-2xl flex flex-wrap gap-2.5 md:gap-4 justify-center items-end min-h-[148px] max-w-full overflow-x-auto">
          {currentGroups.map((group) => {
            const groupRes = ScoringEngine.calculateHandScore([group], publicState.wildJokerCard, false);
            return (
              <CardGroupView
                key={group.id}
                group={group}
                selectedCardIds={selectedCardIds}
                wildJokerCard={publicState.wildJokerCard}
                newlyPickedCardId={lastDrawnCard?.card.cardId}
                onCardClick={handleCardClick}
                onCardDragStart={handleCardDragStart}
                onCardDragOver={handleCardDragOver}
                onCardDrop={handleCardDrop}
                size={cardDisplaySize}
                points={groupRes.penaltyPoints}
              />
            );
          })}
        </div>
      </div>

      {/* Declare Confirmation Modal */}
      {showDeclareConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-gradient-to-b from-slate-900 to-emerald-950 border-2 border-amber-400 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-2">👑</div>
            <h3 className="text-xl font-black text-amber-200 mb-2">Declare Your Show?</h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              You are finishing this deal with your selected card as the Finish card. The server will validate that you hold at least 1 Pure Sequence and 1 Second Sequence. Wrong show incurs an 80-point penalty.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeclareConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeclareSubmit}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/30"
              >
                Yes, Declare Show
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Confirmation Modal */}
      {showDropConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-gradient-to-b from-slate-900 to-red-950 border-2 border-red-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-2">🏳️</div>
            <h3 className="text-xl font-black text-red-300 mb-2">Drop from Deal?</h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Dropping out forfeits the current deal. If this is your first turn without drawing a card, penalty is 20 points. Otherwise, middle drop penalty is 40 points.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDropConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
              >
                Keep Playing
              </button>
              <button
                onClick={() => {
                  dropDeal();
                  setShowDropConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg shadow-red-600/30"
              >
                Confirm Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scoreboard Modal */}
      <ResultModal />
    </div>
  );
};
