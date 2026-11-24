import React from 'react';
import { PlayerPublicInfo } from '@rummy/shared-types';

interface PlayerSeatProps {
  player: PlayerPublicInfo;
  isSelf?: boolean;
  isDealer?: boolean;
  hasTossWin?: boolean;
  hasJustDrawn?: { source: 'CLOSED_DECK' | 'OPEN_DISCARD' } | null;
  className?: string;
  totalTurnDurationSec?: number;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player, isSelf = false, isDealer = false, hasTossWin = false,
  hasJustDrawn = null, className = '', totalTurnDurationSec = 30,
}) => {
  const remaining = player.turnRemainingSec ?? 0;
  const active = player.isTurn && player.status === 'ACTIVE' && remaining > 0;
  const dropped = player.status === 'DROPPED';
  const eliminated = player.status === 'ELIMINATED';
  const circumference = 2 * Math.PI * 43;
  const progress = Math.max(0, Math.min(1, remaining / totalTurnDurationSec));
  const color = remaining > 10 ? '#0bc478' : remaining > 5 ? '#f4bb42' : '#ef5858';
  return (
    <div className={`rummy-seat ${className}`} aria-label={`${isSelf ? 'You' : player.username}, ${player.totalPoolScore} points${active ? `, ${remaining} seconds remaining` : ''}`}>
      <div className={`seat-avatar ${dropped || eliminated ? 'seat-inactive' : ''}`}>
        {active ? <>
          <svg viewBox="0 0 100 100" className="seat-timer" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="none" stroke="#293335" strokeWidth="8" /><circle cx="50" cy="50" r="43" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} /></svg>
          <strong className="seat-seconds">{remaining}</strong>
        </> : <img src={player.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.username)}`} alt="" />}
        {(dropped || eliminated) && <span className="seat-status">{dropped ? 'Dropped' : 'Out'}</span>}
        {hasTossWin && <span className="seat-toss">Toss win</span>}
        {hasJustDrawn && !isSelf && <span className="seat-draw">{hasJustDrawn.source === 'CLOSED_DECK' ? 'Picked a card' : 'Picked discard'}</span>}
      </div>
      <div className="seat-label"><span>{player.totalPoolScore ?? 0} pts</span><b>·</b><span>{isSelf ? 'You' : player.username}</span>{isDealer && <small title="Dealer">D</small>}</div>
    </div>
  );
};
