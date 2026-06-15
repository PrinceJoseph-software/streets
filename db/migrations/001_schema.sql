-- =============================================================================
-- STREETS — Phase 1: Core Schema
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE
-- =============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE engagement_kind AS ENUM ('react', 'vote', 'share');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── GENRES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS genres (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

-- ─── CITIES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cities (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name    TEXT NOT NULL,
  slug    TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT 'NG'
);

-- ─── USERS ────────────────────────────────────────────────────────────────────
-- Mirrors auth.users + Streets-specific metadata.
-- Created automatically via trigger on auth.users INSERT.
-- taste_trust: 0.2 (anon) → 1.0 (registered) … 2.0 (Scout). Clamped in DB.
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle       TEXT UNIQUE,
  is_anonymous BOOLEAN      NOT NULL DEFAULT true,
  taste_trust  NUMERIC      NOT NULL DEFAULT 0.2
                            CHECK (taste_trust >= 0.2 AND taste_trust <= 2.0),
  accuracy     NUMERIC,                        -- updated by recompute_pulse
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── ARTISTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  city_id    UUID        REFERENCES cities(id),
  claimed_by UUID        REFERENCES users(id),
  ignited_at TIMESTAMPTZ,          -- set ONCE on first Top-10 entry; never reset
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TRACKS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id    UUID        NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  genre_id     UUID        REFERENCES genres(id),
  city_id      UUID        REFERENCES cities(id),
  ext_url      TEXT        NOT NULL,
  ext_platform TEXT        NOT NULL DEFAULT 'audiomack',  -- audiomack|spotify|youtube
  clip_url     TEXT,
  cover_url    TEXT        NOT NULL,
  pitch        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ENGAGEMENT EVENTS ────────────────────────────────────────────────────────
-- weight is base_weight * voter's taste_trust, FROZEN at write time.
-- One vote per (user, track) enforced by partial unique index below.
CREATE TABLE IF NOT EXISTS engagement_events (
  id         UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id   UUID            NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  kind       engagement_kind NOT NULL,
  weight     NUMERIC         NOT NULL,
  created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- One vote per (user, track): partial unique index (reactions can repeat)
CREATE UNIQUE INDEX IF NOT EXISTS uix_engagement_one_vote_per_user_track
  ON engagement_events (user_id, track_id)
  WHERE kind = 'vote';

-- ─── SUPPORTER LEDGER ─────────────────────────────────────────────────────────
-- Written once per (fan, artist) at Ignition. Permanent. Unfakeable.
CREATE TABLE IF NOT EXISTS supporter_ledger (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id      UUID        NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  track_id       UUID        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  supporter_rank INT         NOT NULL,   -- ordinal: you were the Nth backer
  weeks_early    NUMERIC     NOT NULL,   -- (ignited_at − first_vote_at) / 7 days
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, artist_id)            -- one ledger entry per (fan, artist)
);

-- ─── RANKINGS ─────────────────────────────────────────────────────────────────
-- Flat, precomputed every 3 min by pg_cron → recompute_pulse().
-- NEVER query engagement_events on read — always query this table.
-- Buckets: 'nigeria' | 'rising' | 'hottest' | 'fresh' | 'city:<uuid>' | 'genre:<uuid>'
CREATE TABLE IF NOT EXISTS rankings (
  bucket     TEXT        NOT NULL,
  track_id   UUID        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  rank       INT,
  pulse      NUMERIC     NOT NULL DEFAULT 0,
  momentum   NUMERIC     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (bucket, track_id)
);

-- ─── FLAGS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flags (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT        NOT NULL,   -- 'track' | 'artist' | 'user'
  target_id   UUID        NOT NULL,
  reason      TEXT        NOT NULL,
  reporter_id UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES (§12 — the ones that matter for performance)
-- =============================================================================

-- engagement_events: windowed Pulse reads — CRITICAL
CREATE INDEX IF NOT EXISTS idx_ee_track_created
  ON engagement_events (track_id, created_at DESC);

-- engagement_events: rate limiting + accuracy per user
CREATE INDEX IF NOT EXISTS idx_ee_user_created
  ON engagement_events (user_id, created_at DESC);

-- rankings: instant feed reads
CREATE INDEX IF NOT EXISTS idx_rankings_bucket_rank
  ON rankings (bucket, rank ASC NULLS LAST);

-- supporter_ledger: "supporter #N" lookups
CREATE INDEX IF NOT EXISTS idx_ledger_artist_rank
  ON supporter_ledger (artist_id, supporter_rank ASC);

-- artists: slug lookups (artist page routing)
CREATE INDEX IF NOT EXISTS idx_artists_slug
  ON artists (slug);

-- tracks: genre + city filter (future chart unlock)
CREATE INDEX IF NOT EXISTS idx_tracks_genre  ON tracks (genre_id);
CREATE INDEX IF NOT EXISTS idx_tracks_city   ON tracks (city_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks (artist_id);

-- =============================================================================
-- ROW LEVEL SECURITY — enabled on every table
-- =============================================================================
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE supporter_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags             ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- Drop existing policies before recreating (idempotent)
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- users: anyone reads; owner updates their own handle
CREATE POLICY "users_select_all"  ON users FOR SELECT USING (true);
CREATE POLICY "users_update_self" ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- artists: anyone reads; registered users submit; owner updates
CREATE POLICY "artists_select_all" ON artists FOR SELECT USING (true);
CREATE POLICY "artists_insert_registered" ON artists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_anonymous = false
    )
  );
CREATE POLICY "artists_update_owner" ON artists FOR UPDATE
  USING (claimed_by = auth.uid())
  WITH CHECK (claimed_by = auth.uid());

-- tracks: anyone reads; registered users submit
CREATE POLICY "tracks_select_all" ON tracks FOR SELECT USING (true);
CREATE POLICY "tracks_insert_registered" ON tracks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_anonymous = false
    )
  );

-- engagement_events: public read; all writes via SECURITY DEFINER RPCs
CREATE POLICY "ee_select_all" ON engagement_events FOR SELECT USING (true);

-- supporter_ledger: public read; writes via SECURITY DEFINER only
CREATE POLICY "ledger_select_all" ON supporter_ledger FOR SELECT USING (true);

-- rankings: public read; writes via SECURITY DEFINER only
CREATE POLICY "rankings_select_all" ON rankings FOR SELECT USING (true);

-- genres / cities: public read only
CREATE POLICY "genres_select_all" ON genres FOR SELECT USING (true);
CREATE POLICY "cities_select_all" ON cities FOR SELECT USING (true);

-- flags: authenticated users insert; no public read (admin uses service role)
CREATE POLICY "flags_insert_authed" ON flags FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- AUTH TRIGGERS
-- Mirror auth.users events into public.users
-- =============================================================================

-- Trigger 1: new user created (anon or registered)
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, is_anonymous, taste_trust)
  VALUES (
    NEW.id,
    COALESCE(NEW.is_anonymous, false),
    CASE WHEN COALESCE(NEW.is_anonymous, false) THEN 0.2 ELSE 1.0 END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Trigger 2: anonymous → permanent upgrade (preserves Ledger history)
CREATE OR REPLACE FUNCTION handle_auth_user_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when transitioning from anonymous to registered
  IF COALESCE(OLD.is_anonymous, false) = true
     AND NEW.is_anonymous = false
  THEN
    UPDATE public.users
    SET
      is_anonymous = false,
      -- Promote to minimum registered trust (1.0), keep higher if already earned
      taste_trust  = GREATEST(taste_trust, 1.0)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_upgraded ON auth.users;
CREATE TRIGGER on_auth_user_upgraded
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_auth_user_upgrade();
