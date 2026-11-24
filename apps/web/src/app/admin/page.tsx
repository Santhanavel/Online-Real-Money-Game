'use client';

import React, { useEffect, useState } from 'react';

export default function AdminPage() {
  const [overview, setOverview] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MATCHMAKING' | 'TABLES' | 'PLAYERS' | 'LOGS'>('OVERVIEW');
  const [mmStats, setMmStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

  const fetchData = async () => {
    try {
      const [ovRes, tblRes, plyRes, logRes, mmRes] = await Promise.all([
        fetch(`${serverUrl}/api/admin/overview`).then((r) => r.json()),
        fetch(`${serverUrl}/api/admin/tables`).then((r) => r.json()),
        fetch(`${serverUrl}/api/admin/players`).then((r) => r.json()),
        fetch(`${serverUrl}/api/admin/audit-logs`).then((r) => r.json()),
        fetch(`${serverUrl}/api/admin/matchmaking/stats`).then((r) => r.json()).catch(() => null),
      ]);

      setOverview(ovRes);
      setTables(Array.isArray(tblRes) ? tblRes : []);
      setPlayers(Array.isArray(plyRes) ? plyRes : []);
      setAuditLogs(Array.isArray(logRes) ? logRes : []);
      setMmStats(mmRes);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load admin data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // live refresh
    return () => clearInterval(interval);
  }, []);

  const handleToggleSuspend = async (playerId: string) => {
    try {
      await fetch(`${serverUrl}/api/admin/players/${playerId}/suspend`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Failed to toggle suspend:', err);
    }
  };

  const filteredPlayers = players.filter(
    (p) =>
      p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-3xl font-black text-amber-200">Admin Control Center</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time table monitoring, fairness oversight, and player management
          </p>
        </div>
        <a
          href="/"
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 self-start"
        >
          ← Exit Admin
        </a>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-white/10 mb-8 max-w-2xl">
        {(['OVERVIEW', 'MATCHMAKING', 'TABLES', 'PLAYERS', 'LOGS'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading admin state...</div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW METRICS */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">Registered Users</span>
                  <span className="text-3xl font-black text-amber-300">
                    {overview?.totalUsers || 0}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">Active Game Tables</span>
                  <span className="text-3xl font-black text-emerald-400">
                    {overview?.activeTablesCount || 0}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">Completed Matches</span>
                  <span className="text-3xl font-black text-amber-200">
                    {overview?.completedGamesCount || 0}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">Active Queue Tickets</span>
                  <span className="text-3xl font-black text-emerald-300">
                    {mmStats?.totalActiveTickets || 0}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 p-6 rounded-2xl border border-white/10">
                <h3 className="text-sm font-bold text-amber-300 mb-3">Format Breakdown</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                    <span className="text-xs text-slate-400 block">Points Rummy Games</span>
                    <span className="text-2xl font-black text-white">
                      {overview?.pointsGamesCount || 0}
                    </span>
                  </div>
                  <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                    <span className="text-xs text-slate-400 block">Pool Rummy Games</span>
                    <span className="text-2xl font-black text-white">
                      {overview?.poolGamesCount || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MATCHMAKING LIVE MONITOR */}
          {activeTab === 'MATCHMAKING' && (
            <div className="space-y-6">
              {/* Ticket Status Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Waiting in Queue</span>
                  <span className="text-2xl font-black text-amber-300">
                    {mmStats?.ticketsByStatus?.QUEUED || 0}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Seats Reserved</span>
                  <span className="text-2xl font-black text-emerald-400">
                    {mmStats?.ticketsByStatus?.RESERVED || 0}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Match Found</span>
                  <span className="text-2xl font-black text-teal-300">
                    {mmStats?.ticketsByStatus?.MATCH_FOUND || 0}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Matches Started</span>
                  <span className="text-2xl font-black text-blue-400">
                    {mmStats?.ticketsByStatus?.STARTED || 0}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Cancelled</span>
                  <span className="text-2xl font-black text-slate-400">
                    {mmStats?.ticketsByStatus?.CANCELLED || 0}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-white/10 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Expired</span>
                  <span className="text-2xl font-black text-red-400">
                    {mmStats?.ticketsByStatus?.EXPIRED || 0}
                  </span>
                </div>
              </div>

              {/* Waiting Tables List */}
              <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-amber-200">
                    Authoritative Waiting Tables ({mmStats?.activeWaitingTablesCount || 0})
                  </h3>
                  <span className="text-xs text-slate-400">Auto-refreshed every 4s</span>
                </div>

                {!mmStats?.activeWaitingTables || mmStats.activeWaitingTables.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No active waiting tables currently filling.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mmStats.activeWaitingTables.map((tbl: any) => (
                      <div
                        key={tbl.tableId}
                        className="bg-black/40 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              {tbl.variant === 'POINTS_240' ? '240 Out for 241' : tbl.variant}
                            </span>
                            <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                              Entry: ₹{tbl.entryAmount || 50}
                            </span>
                            <span className="text-xs text-slate-300 font-semibold">
                              {tbl.capacity}P Table
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              {tbl.status}
                            </span>
                            {tbl.isLocked && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                🔒 LOCKED
                              </span>
                            )}
                            {tbl.countdownSec !== null && tbl.countdownSec !== undefined && tbl.countdownSec > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 animate-pulse border border-amber-500/30">
                                ⏳ Launching in {tbl.countdownSec}s
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              (Timeout in {tbl.remainingSec}s)
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">
                            ID: {tbl.tableId}
                          </span>
                        </div>

                        {/* Seated Pods */}
                        <div className="flex items-center gap-2">
                          {tbl.seats.map((seat: any) => (
                            <div
                              key={seat.seatIndex}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                seat.isOccupied
                                  ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-600 border-dashed'
                              }`}
                            >
                              {seat.isOccupied ? `S${seat.seatIndex + 1}: ${seat.username}` : `S${seat.seatIndex + 1}: Empty`}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE TABLES */}
          {activeTab === 'TABLES' && (
            <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-5 shadow-xl">
              <h3 className="text-lg font-bold text-amber-200 mb-4">
                Active Game Tables ({tables.length})
              </h3>
              {tables.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No active multiplayer tables right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {tables.map((t) => (
                    <div
                      key={t.tableId}
                      className="bg-black/40 p-4 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-amber-400">{t.variant}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                            {t.tableId}
                          </span>
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-bold">
                            Deal #{t.dealNumber}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300">
                          Players: {t.players.map((p: any) => p.username).join(', ')}
                        </div>
                      </div>
                      <div className="text-xs text-emerald-400 font-bold bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
                        {t.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PLAYERS */}
          {activeTab === 'PLAYERS' && (
            <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-5 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-bold text-amber-200">Player Management</h3>
                <input
                  type="text"
                  placeholder="Search player or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="divide-y divide-white/5">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-200">{player.username}</span>
                        <span className="text-xs text-slate-400">({player.email})</span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded font-bold ${
                            player.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-red-950 text-red-300'
                          }`}
                        >
                          {player.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Games: {player.gamesPlayed} • Wins: {player.gamesWon} • Role: {player.role}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleSuspend(player.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        player.status === 'ACTIVE'
                          ? 'bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/30'
                          : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/30'
                      }`}
                    >
                      {player.status === 'ACTIVE' ? 'Suspend Account' : 'Reactivate Account'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT LOGS */}
          {activeTab === 'LOGS' && (
            <div className="bg-slate-900/80 rounded-2xl border border-white/10 p-5 shadow-xl">
              <h3 className="text-lg font-bold text-amber-200 mb-4">
                Fairness & Administrative Audit Logs
              </h3>
              {auditLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No administrative actions logged yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-black/30 p-3 rounded-xl border border-white/5 text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-amber-400 mr-2">[{log.action}]</span>
                        <span className="text-slate-300">
                          Target: {log.targetId} • By: {log.adminId}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
