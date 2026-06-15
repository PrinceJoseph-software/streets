-- =============================================================================
-- STREETS — Phase 1: RPC Functions
-- All write-path logic lives here (SECURITY DEFINER = server-side, unforgeable)
-- Run AFTER 001_schema.sql
-- =============================================================================

-- =============================================================================
-- cast_vote(p_track_id)
-- base_weight 3 × caller's taste_trust, frozen at write time.
-- Requires a permanent (non-anonymous) account.
-- Enforces one-vote-per-(user,track) via the partial unique index.
-- =============================================================================
CREATE OR REPLACE FUNCTION cast_vote(p_track_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID    := auth.uid();
  v_trust    NUMERIC;
  v_weight   NUMERIC;
BEGIN
  -- ── Auth guard ─────────────────────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required'
      USING HINT = 'Sign in to vote.';
  END IF;

  -- ── Registered-only guard (anon users may react but not vote) ──────────────
  SELECT taste_trust INTO v_trust
  FROM public.users
  WHERE id = v_user_id AND is_anonymous = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration_required'
      USING HINT = 'Create a permanent account to vote and build your Ledger.';
  END IF;

  -- ── Burst-voting guard (> 10 unique tracks in 10 min = suspicious) ─────────
  IF (
    SELECT COUNT(DISTINCT track_id)
    FROM engagement_events
    WHERE user_id   = v_user_id
      AND kind      = 'vote'
      AND created_at > NOW() - INTERVAL '10 minutes'
  ) >= 10 THEN
    -- Log the pattern and penalise trust
    INSERT INTO flags (target_type, target_id, reason, reporter_id)
    VALUES ('user', v_user_id, 'burst_voting', v_user_id);

    UPDATE public.users
    SET taste_trust = GREATEST(0.2, taste_trust - 0.05)
    WHERE id = v_user_id;

    RAISE EXCEPTION 'rate_limit_exceeded'
      USING HINT = 'Too many votes in a short window. Slow down.';
  END IF;

  -- ── Write the event (weight frozen at this moment's trust level) ───────────
  v_weight := 3.0 * v_trust;

  BEGIN
    INSERT INTO engagement_events (user_id, track_id, kind, weight)
    VALUES (v_user_id, p_track_id, 'vote', v_weight);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'already_voted'
        USING HINT = 'You have already voted for this track.';
  END;
END;
$$;

-- =============================================================================
-- cast_reaction(p_track_id)
-- base_weight 1. Open to anonymous users (trust 0.2 → weight 0.2).
-- Rate-limited: max 5 reactions per (user, track) per 24 hours.
-- =============================================================================
CREATE OR REPLACE FUNCTION cast_reaction(p_track_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID    := auth.uid();
  v_trust   NUMERIC;
  v_weight  NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required'
      USING HINT = 'Anonymous session required. Reload and try again.';
  END IF;

  -- Get trust (defaults to 0.2 for anon if row exists)
  SELECT taste_trust INTO v_trust
  FROM public.users
  WHERE id = v_user_id;

  -- If no profile row yet, use anon floor (trigger should have created it)
  IF NOT FOUND THEN
    v_trust := 0.2;
  END IF;

  -- Rate limit: max 5 reactions on the same track within 24h
  IF (
    SELECT COUNT(*)
    FROM engagement_events
    WHERE user_id    = v_user_id
      AND track_id   = p_track_id
      AND kind       = 'react'
      AND created_at > NOW() - INTERVAL '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
      USING HINT = 'Max reactions on this track reached for today.';
  END IF;

  v_weight := 1.0 * v_trust;

  INSERT INTO engagement_events (user_id, track_id, kind, weight)
  VALUES (v_user_id, p_track_id, 'react', v_weight);
END;
$$;

-- =============================================================================
-- record_share(p_track_id)
-- base_weight 4 (shares are the growth currency).
-- Open to all users incl. anonymous. Max 3 share events per (user, track)
-- to prevent artificial inflation.
-- =============================================================================
CREATE OR REPLACE FUNCTION record_share(p_track_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID    := auth.uid();
  v_trust   NUMERIC;
  v_weight  NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required'
      USING HINT = 'Anonymous session required.';
  END IF;

  SELECT taste_trust INTO v_trust
  FROM public.users
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    v_trust := 0.2;
  END IF;

  -- Cap: max 3 share records per (user, track) lifetime
  IF (
    SELECT COUNT(*)
    FROM engagement_events
    WHERE user_id  = v_user_id
      AND track_id = p_track_id
      AND kind     = 'share'
  ) >= 3 THEN
    RETURN; -- silently succeed (share happened, we just don't double-count)
  END IF;

  v_weight := 4.0 * v_trust;

  INSERT INTO engagement_events (user_id, track_id, kind, weight)
  VALUES (v_user_id, p_track_id, 'share', v_weight);
END;
$$;

-- =============================================================================
-- recompute_pulse()
-- Called by pg_cron every 3 minutes.
-- Computes Pulse, Momentum, applies cold-start bonus, writes rankings,
-- detects Ignition, writes Supporter Ledger, updates Taste Trust.
-- NEVER called on read — always runs as a background job.
-- =============================================================================
CREATE OR REPLACE FUNCTION recompute_pulse()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();

  -- ── Ignition thresholds (named constants) ─────────────────────────────────
  -- An artist ignites when they hit the Top 10 Nigeria AND cross BOTH bars.
  -- With only 3 seed users the weight cap is 3×(3×1.5)=13.5 — well below 40,
  -- so the seed dataset can never trigger ignition accidentally.
  IGNITION_MIN_TRUSTED_WEIGHT   CONSTANT NUMERIC := 40;
  IGNITION_MIN_DISTINCT_BACKERS CONSTANT INT     := 20;

BEGIN

  -- ── Step 1: Compute scores for all tracks in one CTE pass ─────────────────
  -- Uses set-based SQL (no row loops) for performance.
  WITH
  -- Aggregate engagement per track, split into time windows
  pulse_raw AS (
    SELECT
      ee.track_id,

      -- Hottest Today: 18-hour half-life, 48-hour look-back
      COALESCE(SUM(
        CASE WHEN ee.created_at > v_now - INTERVAL '48 hours'
          THEN ee.weight * POWER(0.5,
            EXTRACT(EPOCH FROM (v_now - ee.created_at)) / 3600.0 / 18.0)
          ELSE 0 END
      ), 0) AS pulse_hottest,

      -- Trending Week: 5-day (120h) half-life, 14-day look-back
      COALESCE(SUM(
        CASE WHEN ee.created_at > v_now - INTERVAL '14 days'
          THEN ee.weight * POWER(0.5,
            EXTRACT(EPOCH FROM (v_now - ee.created_at)) / 3600.0 / 120.0)
          ELSE 0 END
      ), 0) AS pulse_week,

      -- Momentum last-24h (same 18h decay to keep units consistent)
      COALESCE(SUM(
        CASE WHEN ee.created_at > v_now - INTERVAL '24 hours'
          THEN ee.weight * POWER(0.5,
            EXTRACT(EPOCH FROM (v_now - ee.created_at)) / 3600.0 / 18.0)
          ELSE 0 END
      ), 0) AS pulse_24h,

      -- Momentum prev-24h (the 24h-48h window, time-shifted to "now-24h")
      COALESCE(SUM(
        CASE WHEN ee.created_at BETWEEN v_now - INTERVAL '48 hours'
                                    AND v_now - INTERVAL '24 hours'
          THEN ee.weight * POWER(0.5,
            EXTRACT(EPOCH FROM ((v_now - INTERVAL '24 hours') - ee.created_at))
            / 3600.0 / 18.0)
          ELSE 0 END
      ), 0) AS pulse_prev_24h

    FROM engagement_events ee
    WHERE ee.created_at > v_now - INTERVAL '14 days'
    GROUP BY ee.track_id
  ),

  -- Join every track (even zero-engagement) with its scores
  track_scores AS (
    SELECT
      t.id          AS track_id,
      t.artist_id,
      t.city_id,
      t.genre_id,
      t.created_at  AS track_created_at,

      COALESCE(pr.pulse_hottest,  0) AS pulse_hottest,
      COALESCE(pr.pulse_week,     0) AS pulse_week,
      COALESCE(pr.pulse_24h,      0) AS pulse_24h,
      COALESCE(pr.pulse_prev_24h, 0) AS pulse_prev_24h,

      -- Momentum = last_24h / (prev_24h + 3)   [k=3 smooths cold-start tracks]
      COALESCE(pr.pulse_24h, 0) / (COALESCE(pr.pulse_prev_24h, 0) + 3.0)
        AS momentum,

      -- Cold-start bonus: 1.5× at birth, decays linearly to 1.0× at 72h
      -- Applied only to hottest/fresh surfaces, not the national weekly chart
      CASE
        WHEN EXTRACT(EPOCH FROM (v_now - t.created_at)) / 3600.0 < 72.0
          THEN 1.0 + 0.5 * (
            1.0 - EXTRACT(EPOCH FROM (v_now - t.created_at)) / 3600.0 / 72.0
          )
        ELSE 1.0
      END AS cold_start_mult,

      EXTRACT(EPOCH FROM (v_now - t.created_at)) / 3600.0 AS age_hours

    FROM tracks t
    LEFT JOIN pulse_raw pr ON pr.track_id = t.id
  ),

  -- Final per-track scores (apply cold-start boost to hottest pulse)
  final AS (
    SELECT
      track_id, artist_id, city_id, genre_id, age_hours,
      pulse_week                         AS pulse_national,
      pulse_hottest * cold_start_mult    AS pulse_hottest_boosted,
      pulse_24h                          AS pulse_rising,
      momentum
    FROM track_scores
  ),

  -- Produce all (bucket, track_id) rows for this cron run
  all_bucket_rows AS (
    -- Nigeria national chart
    SELECT 'nigeria'::TEXT AS bucket, track_id,
           pulse_national AS pulse, momentum
    FROM final
    UNION ALL
    -- Hottest Today (cold-start boosted)
    SELECT 'hottest', track_id, pulse_hottest_boosted, momentum
    FROM final
    UNION ALL
    -- Rising Now (sorted by momentum in ranking step below)
    SELECT 'rising', track_id, pulse_rising, momentum
    FROM final
    UNION ALL
    -- Fresh: only tracks < 72h old (cold-start boosted)
    SELECT 'fresh', track_id, pulse_hottest_boosted, momentum
    FROM final
    WHERE age_hours < 72.0
    UNION ALL
    -- Per-city buckets (unlocks at ≥15 artists in city — gate at app layer)
    SELECT 'city:' || city_id::TEXT, track_id, pulse_national, momentum
    FROM final
    WHERE city_id IS NOT NULL
    UNION ALL
    -- Per-genre buckets
    SELECT 'genre:' || genre_id::TEXT, track_id, pulse_national, momentum
    FROM final
    WHERE genre_id IS NOT NULL
  )

  -- Upsert into flat rankings table
  INSERT INTO rankings (bucket, track_id, pulse, momentum, updated_at)
  SELECT bucket, track_id, pulse, momentum, v_now
  FROM all_bucket_rows
  ON CONFLICT (bucket, track_id) DO UPDATE
    SET pulse      = EXCLUDED.pulse,
        momentum   = EXCLUDED.momentum,
        updated_at = EXCLUDED.updated_at;

  -- ── Step 2: Remove stale 'fresh' rows (tracks that aged past 72h) ──────────
  DELETE FROM rankings
  WHERE bucket = 'fresh'
    AND track_id IN (
      SELECT id FROM tracks
      WHERE EXTRACT(EPOCH FROM (v_now - created_at)) / 3600.0 >= 72.0
    );

  -- ── Step 3: Rank within each bucket ───────────────────────────────────────
  -- 'rising' sorted by momentum DESC; all others by pulse DESC
  WITH ranked AS (
    SELECT
      bucket,
      track_id,
      ROW_NUMBER() OVER (
        PARTITION BY bucket
        ORDER BY
          CASE WHEN bucket = 'rising' THEN momentum ELSE pulse END DESC
      )::INT AS new_rank
    FROM rankings
  )
  UPDATE rankings r
  SET rank = rk.new_rank
  FROM ranked rk
  WHERE r.bucket = rk.bucket
    AND r.track_id = rk.track_id;

  -- ── Step 4: IGNITION ───────────────────────────────────────────────────────
  -- ALL THREE conditions must hold simultaneously:
  --   1. Artist has a track in the Top 10 of the 'nigeria' bucket.
  --   2. Cumulative trust-weighted vote score >= IGNITION_MIN_TRUSTED_WEIGHT (40).
  --      Prevents artists with a handful of high-trust voters from igniting.
  --   3. Distinct backers (unique voters) >= IGNITION_MIN_DISTINCT_BACKERS (20).
  --      Ensures breadth of community buy-in, not just a single power-user.
  UPDATE artists a
  SET ignited_at = v_now
  WHERE a.ignited_at IS NULL
    -- Condition 1: in the national Top 10
    AND EXISTS (
      SELECT 1
      FROM rankings r
      JOIN tracks t ON t.id = r.track_id
      WHERE t.artist_id = a.id
        AND r.bucket = 'nigeria'
        AND r.rank   <= 10
    )
    -- Condition 2: enough trust-weighted vote mass
    AND (
      SELECT COALESCE(SUM(ee.weight), 0)
      FROM engagement_events ee
      JOIN tracks t ON t.id = ee.track_id
      WHERE t.artist_id = a.id
        AND ee.kind = 'vote'
    ) >= IGNITION_MIN_TRUSTED_WEIGHT
    -- Condition 3: enough distinct backers
    AND (
      SELECT COUNT(DISTINCT ee.user_id)
      FROM engagement_events ee
      JOIN tracks t ON t.id = ee.track_id
      WHERE t.artist_id = a.id
        AND ee.kind = 'vote'
    ) >= IGNITION_MIN_DISTINCT_BACKERS;

  -- ── Step 5: SUPPORTER LEDGER — write for artists that just ignited ─────────
  -- Finds every user who cast a vote on the artist BEFORE ignited_at,
  -- orders by first-vote timestamp to assign supporter_rank (1 = earliest backer),
  -- computes weeks_early = (ignited_at − first_vote) / 7 days.
  -- WITH must precede INSERT per PostgreSQL CTE syntax rules.
  WITH newly_ignited AS (
    -- Only process artists ignited in this cron run (or the previous one — 6-min
    -- window handles the unlikely case of a run overlapping the previous)
    SELECT id, ignited_at
    FROM artists
    WHERE ignited_at IS NOT NULL
      AND ignited_at >= v_now - INTERVAL '6 minutes'
  ),
  first_votes AS (
    -- Earliest vote per (user, artist) cast before ignition
    SELECT DISTINCT ON (ee.user_id, t.artist_id)
      ee.user_id,
      t.artist_id,
      ee.track_id,
      ee.created_at AS first_vote_at
    FROM engagement_events ee
    JOIN tracks        t  ON t.id  = ee.track_id
    JOIN newly_ignited ni ON ni.id = t.artist_id
    WHERE ee.kind        = 'vote'
      AND ee.created_at  < ni.ignited_at
    ORDER BY ee.user_id, t.artist_id, ee.created_at ASC
  )
  INSERT INTO supporter_ledger
    (user_id, artist_id, track_id, supporter_rank, weeks_early)
  SELECT
    fv.user_id,
    fv.artist_id,
    fv.track_id,
    ROW_NUMBER() OVER (
      PARTITION BY fv.artist_id
      ORDER BY fv.first_vote_at ASC
    )::INT AS supporter_rank,
    ROUND(
      EXTRACT(EPOCH FROM (a.ignited_at - fv.first_vote_at)) / 604800.0, 1
    ) AS weeks_early
  FROM first_votes fv
  JOIN artists a ON a.id = fv.artist_id
  ON CONFLICT (user_id, artist_id) DO NOTHING;

  -- ── Step 6: TASTE TRUST UPDATES ───────────────────────────────────────────

  -- 6a. Reward: backers of newly-ignited artists (you were right)
  UPDATE public.users u
  SET taste_trust = LEAST(2.0, u.taste_trust + 0.1)
  WHERE u.id IN (
    SELECT sl.user_id
    FROM supporter_ledger sl
    JOIN artists a ON a.id = sl.artist_id
    WHERE a.ignited_at IS NOT NULL
      AND a.ignited_at >= v_now - INTERVAL '6 minutes'
  );

  -- 6b. Penalise: burst-voting pattern (> 10 unique tracks in 10 min)
  UPDATE public.users u
  SET taste_trust = GREATEST(0.2, u.taste_trust - 0.05)
  WHERE u.id IN (
    SELECT user_id
    FROM engagement_events
    WHERE kind       = 'vote'
      AND created_at > v_now - INTERVAL '10 minutes'
    GROUP BY user_id
    HAVING COUNT(DISTINCT track_id) > 10
  );

  -- 6c. Update accuracy: pre-ignition correct picks / total picks
  -- Only for users who have ever voted
  WITH vote_stats AS (
    SELECT
      ee.user_id,
      COUNT(DISTINCT CASE WHEN a.ignited_at IS NOT NULL
                           AND ee.created_at < a.ignited_at
                          THEN t.artist_id END)::NUMERIC
        AS correct_picks,
      COUNT(DISTINCT t.artist_id)::NUMERIC
        AS total_picks
    FROM engagement_events ee
    JOIN tracks  t ON t.id  = ee.track_id
    JOIN artists a ON a.id  = t.artist_id
    WHERE ee.kind = 'vote'
    GROUP BY ee.user_id
  )
  UPDATE public.users u
  SET accuracy = CASE
    WHEN vs.total_picks > 0
      THEN ROUND(vs.correct_picks / vs.total_picks, 3)
    ELSE NULL
  END
  FROM vote_stats vs
  WHERE u.id = vs.user_id;

END;
$$;

-- =============================================================================
-- Grant execute permissions on RPCs to authenticated + anon roles
-- (SECURITY DEFINER functions bypass RLS, but callers still need EXECUTE)
-- =============================================================================
GRANT EXECUTE ON FUNCTION cast_vote(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION cast_reaction(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_share(UUID)  TO authenticated, anon;
-- recompute_pulse is called by pg_cron (postgres role), not by clients
