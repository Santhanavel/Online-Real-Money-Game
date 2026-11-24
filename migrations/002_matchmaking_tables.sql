-- ====================================================================
-- RUMMY ROYALE — PRODUCTION POSTGRESQL MATCHMAKING SCHEMA MIGRATION
-- Migration: 002_matchmaking_tables.sql
-- Status: PREPARED FOR HUMAN REVIEW (DO NOT AUTO-APPLY WITHOUT APPROVAL)
-- ====================================================================

-- 1. MATCHMAKING TICKETS TABLE
-- Stores authoritative records of every player queue ticket.
-- Invariant: Exactly one active ticket per player enforced via partial unique index.
CREATE TABLE IF NOT EXISTS matchmaking_tickets (
    ticket_id VARCHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    socket_id VARCHAR(64) NOT NULL,
    game_type VARCHAR(32) NOT NULL CHECK (game_type IN ('POINTS', 'POOL_101', 'POOL_201')),
    pool_variant VARCHAR(32) CHECK (pool_variant IN ('POOL_101', 'POOL_201')),
    table_capacity SMALLINT NOT NULL CHECK (table_capacity IN (2, 6)),
    table_configuration_id VARCHAR(64) NOT NULL,
    point_value NUMERIC(10, 2) NOT NULL CHECK (point_value > 0),
    rules_version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
    ticket_status VARCHAR(32) NOT NULL DEFAULT 'QUEUED' 
        CHECK (ticket_status IN ('QUEUED', 'RESERVED', 'MATCH_FOUND', 'READY', 'STARTED', 'CANCELLED', 'EXPIRED', 'FAILED')),
    current_table_id VARCHAR(64),
    assigned_seat_index SMALLINT CHECK (assigned_seat_index >= 0 AND assigned_seat_index < 6),
    reservation_expiry TIMESTAMP WITH TIME ZONE,
    queue_entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_heartbeat_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Partial unique index: Guarantee a player has at most ONE active matchmaking ticket at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_ticket_per_player 
ON matchmaking_tickets(player_id) 
WHERE ticket_status IN ('QUEUED', 'RESERVED', 'MATCH_FOUND', 'READY');

-- Indexes for efficient queue lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_matchmaking_tickets_status ON matchmaking_tickets(ticket_status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_tickets_config ON matchmaking_tickets(table_configuration_id, ticket_status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_tickets_queue_time ON matchmaking_tickets(queue_entered_at ASC);
CREATE INDEX IF NOT EXISTS idx_matchmaking_tickets_expiry ON matchmaking_tickets(reservation_expiry) WHERE reservation_expiry IS NOT NULL;

-- 2. WAITING TABLES TABLE
-- Tracks live waiting tables before game start
CREATE TABLE IF NOT EXISTS waiting_tables (
    table_id VARCHAR(64) PRIMARY KEY,
    game_type VARCHAR(32) NOT NULL CHECK (game_type IN ('POINTS', 'POOL_101', 'POOL_201')),
    pool_variant VARCHAR(32) CHECK (pool_variant IN ('POOL_101', 'POOL_201')),
    table_capacity SMALLINT NOT NULL CHECK (table_capacity IN (2, 6)),
    point_value NUMERIC(10, 2) NOT NULL CHECK (point_value > 0),
    table_configuration_id VARCHAR(64) NOT NULL,
    rules_version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
    occupied_seat_count SMALLINT NOT NULL DEFAULT 0 CHECK (occupied_seat_count >= 0 AND occupied_seat_count <= table_capacity),
    table_status VARCHAR(32) NOT NULL DEFAULT 'WAITING'
        CHECK (table_status IN ('WAITING', 'FILLING', 'FULL', 'LOCKED', 'READY_CHECK', 'STARTING', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'FAILED')),
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waiting_tables_compat ON waiting_tables(table_configuration_id, table_status);
CREATE INDEX IF NOT EXISTS idx_waiting_tables_status ON waiting_tables(table_status);

-- 3. SEAT RESERVATIONS TABLE
-- Tracks atomic seat claims within waiting tables
-- Invariant: Unique seat index per table; unique player reservation per table
CREATE TABLE IF NOT EXISTS seat_reservations (
    reservation_id VARCHAR(64) PRIMARY KEY,
    table_id VARCHAR(64) NOT NULL REFERENCES waiting_tables(table_id) ON DELETE CASCADE,
    ticket_id VARCHAR(64) NOT NULL REFERENCES matchmaking_tickets(ticket_id) ON DELETE CASCADE,
    player_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_index SMALLINT NOT NULL CHECK (seat_index >= 0 AND seat_index < 6),
    status VARCHAR(32) NOT NULL DEFAULT 'RESERVED'
        CHECK (status IN ('RESERVED', 'CONFIRMED', 'RELEASED', 'EXPIRED')),
    reserved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_table_seat UNIQUE (table_id, seat_index),
    CONSTRAINT uq_table_player UNIQUE (table_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_seat_reservations_player ON seat_reservations(player_id, status);
CREATE INDEX IF NOT EXISTS idx_seat_reservations_expires ON seat_reservations(expires_at) WHERE status = 'RESERVED';

-- 4. MATCH CONFIRMATIONS TABLE
-- Guarantees that only ONE game session is confirmed per waiting table
CREATE TABLE IF NOT EXISTS match_confirmations (
    confirmation_id VARCHAR(64) PRIMARY KEY,
    table_id VARCHAR(64) NOT NULL UNIQUE REFERENCES waiting_tables(table_id),
    game_session_id VARCHAR(64) NOT NULL UNIQUE,
    player_count SMALLINT NOT NULL,
    player_ids JSONB NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. MATCHMAKING AUDIT EVENTS TABLE
-- Immutable event stream for observability and security auditing
CREATE TABLE IF NOT EXISTS matchmaking_events (
    event_id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    ticket_id VARCHAR(64),
    player_id VARCHAR(64) NOT NULL,
    table_id VARCHAR(64),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_events_ticket ON matchmaking_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_events_player ON matchmaking_events(player_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_events_type ON matchmaking_events(event_type, created_at DESC);
