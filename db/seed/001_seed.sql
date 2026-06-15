-- =============================================================================
-- STREETS — Dev Seed  (idempotent — safe to re-run)
-- Run in Supabase SQL Editor AFTER all migrations.
--
-- Creates:
--   • 3 named seed users  (tochi / ama / scout1)
--   • 22 lightweight fan users (fan01–fan22, trust 1.0)
--   • 2 genres, 2 cities
--   • 10 artists + 10 tracks
--   • Engagement events with deliberate timestamps
--
-- Ignition outcome (after recompute_pulse()):
--   • Dré "No Pressure"  → IGNITED  (25 distinct backers / 76.5 weight)
--   • All other artists  → pre-ignition (≤3 backers each, never reach 20)
--
-- Fan-card demo:
--   fan01 (@fan01) → supporter #1, ~8 weeks early
--   fan02 (@fan02) → supporter #2, ~7.4 weeks early
--   fan03 (@fan03) → supporter #3, ~7 weeks early
--   fan04 (@fan04) → supporter #4, ~6.4 weeks early
-- =============================================================================

-- ─── Step 0: Ensure pgcrypto is available ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- Step 1a: Named seed users (auth.users)
-- =============================================================================
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  is_anonymous, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'tochi@streets.dev',
    crypt('Streets2025!', gen_salt('bf')),
    NOW(), false, NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'ama@streets.dev',
    crypt('Streets2025!', gen_salt('bf')),
    NOW(), false, NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'scout@streets.dev',
    crypt('Streets2025!', gen_salt('bf')),
    NOW(), false, NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- Patch public.users (trigger may have fired before email confirm)
UPDATE public.users SET is_anonymous = false, taste_trust = 1.0
WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
);

UPDATE public.users SET handle = 'tochi'  WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.users SET handle = 'ama'    WHERE id = 'a0000000-0000-0000-0000-000000000002';
UPDATE public.users SET handle = 'scout1' WHERE id = 'a0000000-0000-0000-0000-000000000003';

-- Scout has earned reputation
UPDATE public.users SET taste_trust = 1.5
WHERE id = 'a0000000-0000-0000-0000-000000000003';

-- =============================================================================
-- Step 1b: 22 fan users (fan01–fan22, IDs a0000000-…-000000000004 … 000000000025)
-- These users only vote on Dré to push him across the ignition bars.
-- =============================================================================
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  is_anonymous, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  ('a0000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::UUID,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'fan' || LPAD((n - 3)::text, 2, '0') || '@streets.dev',
  crypt('Streets2025!', gen_salt('bf')),
  NOW(), false, NOW(), NOW(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
FROM generate_series(4, 25) AS n
ON CONFLICT (id) DO NOTHING;

-- Patch public.users for all fan users
UPDATE public.users
SET is_anonymous = false, taste_trust = 1.0
WHERE id IN (
  SELECT ('a0000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::UUID
  FROM generate_series(4, 25) AS n
);

-- Set handles: fan01 … fan22
UPDATE public.users
SET handle = 'fan' || LPAD((n - 3)::text, 2, '0')
FROM generate_series(4, 25) AS n
WHERE id = ('a0000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::UUID;

-- =============================================================================
-- Step 2: Genres
-- =============================================================================
INSERT INTO genres (id, name, slug) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Afrobeats',  'afrobeats'),
  ('b0000000-0000-0000-0000-000000000002', 'Alté',       'alte'),
  ('b0000000-0000-0000-0000-000000000003', 'Afro-Pop',   'afro-pop'),
  ('b0000000-0000-0000-0000-000000000004', 'Street-Pop', 'street-pop')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Step 3: Cities
-- =============================================================================
INSERT INTO cities (id, name, slug, country) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Port Harcourt', 'port-harcourt', 'NG'),
  ('c0000000-0000-0000-0000-000000000002', 'Lagos',         'lagos',         'NG'),
  ('c0000000-0000-0000-0000-000000000003', 'Abuja',         'abuja',         'NG')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- Step 4: Artists (10)
-- =============================================================================
INSERT INTO artists (id, slug, name, city_id, created_at) VALUES
  -- PH underground — Dré will ignite
  ('d0000000-0000-0000-0000-000000000001', 'dre-ph',      'Dré',        'c0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days'),
  ('d0000000-0000-0000-0000-000000000002', 'zola-ph',     'Zola',       'c0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '25 days'),
  ('d0000000-0000-0000-0000-000000000003', 'mo-vibez',    'Mo Vibez',   'c0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '20 days'),
  -- Lagos underground
  ('d0000000-0000-0000-0000-000000000004', 'echo-lagos',  'Echo',       'c0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '15 days'),
  ('d0000000-0000-0000-0000-000000000005', 'k-dark',      'K-Dark',     'c0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '12 days'),
  ('d0000000-0000-0000-0000-000000000006', 'temi-waves',  'Temi Waves', 'c0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '10 days'),
  -- Abuja
  ('d0000000-0000-0000-0000-000000000007', 'abj-gold',    'ABJ Gold',   'c0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '8 days'),
  ('d0000000-0000-0000-0000-000000000008', 'seer-abj',    'Seer',       'c0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '6 days'),
  -- Fresh drops (< 72h — appear in 'fresh' bucket)
  ('d0000000-0000-0000-0000-000000000009', 'nova-ph',     'Nova',       'c0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '40 hours'),
  ('d0000000-0000-0000-0000-000000000010', 'rue-lagos',   'Rue',        'c0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '20 hours')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Step 5: Tracks (one per artist)
-- =============================================================================
INSERT INTO tracks (id, artist_id, title, genre_id, city_id, ext_url, ext_platform, cover_url, pitch, created_at)
VALUES
  ('e0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'No Pressure', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'https://audiomack.com/dre-ph/song/no-pressure',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/FFE000?text=DRE',
   'PH to the world. This one hits different at 2am.',
   NOW() - INTERVAL '30 days'),

  ('e0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000002',
   'Cold Season', 'b0000000-0000-0000-0000-000000000004',
   'c0000000-0000-0000-0000-000000000001',
   'https://audiomack.com/zola-ph/song/cold-season',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=ZOLA',
   'Streets know Zola been cooking.',
   NOW() - INTERVAL '25 days'),

  ('e0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000003',
   'Overtime', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'https://audiomack.com/mo-vibez/song/overtime',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=MO',
   NULL,
   NOW() - INTERVAL '20 days'),

  ('e0000000-0000-0000-0000-000000000004',
   'd0000000-0000-0000-0000-000000000004',
   'Echo Chamber', 'b0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000002',
   'https://audiomack.com/echo-lagos/song/echo-chamber',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=ECHO',
   'Alté rising out of Yaba.',
   NOW() - INTERVAL '15 days'),

  ('e0000000-0000-0000-0000-000000000005',
   'd0000000-0000-0000-0000-000000000005',
   'Dark Hours', 'b0000000-0000-0000-0000-000000000004',
   'c0000000-0000-0000-0000-000000000002',
   'https://audiomack.com/k-dark/song/dark-hours',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=KDARK',
   NULL,
   NOW() - INTERVAL '12 days'),

  ('e0000000-0000-0000-0000-000000000006',
   'd0000000-0000-0000-0000-000000000006',
   'Wavelength', 'b0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000002',
   'https://audiomack.com/temi-waves/song/wavelength',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=TEMI',
   'Temi does not miss.',
   NOW() - INTERVAL '10 days'),

  ('e0000000-0000-0000-0000-000000000007',
   'd0000000-0000-0000-0000-000000000007',
   'Gold Standard', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003',
   'https://audiomack.com/abj-gold/song/gold-standard',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=GOLD',
   NULL,
   NOW() - INTERVAL '8 days'),

  ('e0000000-0000-0000-0000-000000000008',
   'd0000000-0000-0000-0000-000000000008',
   'Vision', 'b0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000003',
   'https://audiomack.com/seer-abj/song/vision',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=SEER',
   'They will understand it later.',
   NOW() - INTERVAL '6 days'),

  -- Fresh tracks (< 72h) — appear in 'fresh' bucket
  ('e0000000-0000-0000-0000-000000000009',
   'd0000000-0000-0000-0000-000000000009',
   'First Light', 'b0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000001',
   'https://audiomack.com/nova-ph/song/first-light',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=NOVA',
   'Nova just dropped. You heard it here.',
   NOW() - INTERVAL '40 hours'),

  ('e0000000-0000-0000-0000-000000000010',
   'd0000000-0000-0000-0000-000000000010',
   'Rue the Day', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002',
   'https://audiomack.com/rue-lagos/song/rue-the-day',
   'audiomack',
   'https://placehold.co/400x400/0A0A0A/F4F1EA?text=RUE',
   NULL,
   NOW() - INTERVAL '20 hours')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Step 6: Engagement events
-- =============================================================================
-- Idempotent: purge all seed-user events on seed tracks, reset ignition state.
--
-- ── Dré "No Pressure" — designed to IGNITE ───────────────────────────────────
-- Backers: 25 distinct users (fans 01–22 + tochi + ama + scout1)
-- Vote weight: 22×3.0 + 3.0 + 3.0 + 4.5 = 76.5  (bars: ≥40 weight, ≥20 backers ✓)
--
-- Timeline design (drives weeks_early on the fan card):
--   fans 01–04  voted 45–56 days ago → weeks_early 6.4–8.0  ← the "I called it" crew
--   fans 05–09  voted 18–28 days ago → weeks_early 2.6–4.0
--   fans 10–22  voted  1–7  days ago → weeks_early 0.1–1.0  ← the "pile-on" wave
--   tochi/ama/scout1 voted 1–5 days ago (same wave)
--
-- recompute_pulse() sets ignited_at = NOW() when it runs, then writes the
-- supporter_ledger with supporter_rank (1=earliest) and weeks_early per backer.
-- ── All other artists: ≤3 backers — never approach the 20-backer bar ─────────

-- 6a. Purge old seed events (scoped to seed user IDs 001–025 × seed track IDs)
DELETE FROM engagement_events
WHERE user_id IN (
  SELECT ('a0000000-0000-0000-0000-' || LPAD(n::text, 12, '0'))::UUID
  FROM generate_series(1, 25) AS n
)
AND track_id IN (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000004',
  'e0000000-0000-0000-0000-000000000005',
  'e0000000-0000-0000-0000-000000000006',
  'e0000000-0000-0000-0000-000000000007',
  'e0000000-0000-0000-0000-000000000008',
  'e0000000-0000-0000-0000-000000000009',
  'e0000000-0000-0000-0000-000000000010'
);

-- 6b. Reset any ignitions and ledger entries from a previous run
UPDATE artists SET ignited_at = NULL
WHERE id IN (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005',
  'd0000000-0000-0000-0000-000000000006',
  'd0000000-0000-0000-0000-000000000007',
  'd0000000-0000-0000-0000-000000000008',
  'd0000000-0000-0000-0000-000000000009',
  'd0000000-0000-0000-0000-000000000010'
);

DELETE FROM supporter_ledger
WHERE artist_id IN (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003',
  'd0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005',
  'd0000000-0000-0000-0000-000000000006',
  'd0000000-0000-0000-0000-000000000007',
  'd0000000-0000-0000-0000-000000000008',
  'd0000000-0000-0000-0000-000000000009',
  'd0000000-0000-0000-0000-000000000010'
);

-- 6c. Insert engagement events
INSERT INTO engagement_events (user_id, track_id, kind, weight, created_at)
VALUES

  -- ════════════════════════════════════════════════════════════════════════════
  -- DRÉ "No Pressure" (e...001)
  -- ════════════════════════════════════════════════════════════════════════════

  -- ── Early believers — voted 6–8 weeks ago (these produce meaningful weeks_early)
  -- fan01 → supporter #1,  ~8.0 weeks early
  ('a0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '56 days'),
  -- fan02 → supporter #2,  ~7.4 weeks early
  ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '52 days'),
  -- fan03 → supporter #3,  ~7.0 weeks early
  ('a0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '49 days'),
  -- fan04 → supporter #4,  ~6.4 weeks early
  ('a0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '45 days'),

  -- ── Mid adopters — voted 3–4 weeks ago
  -- fan05 → supporter #5,  ~4.0 weeks early
  ('a0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '28 days'),
  -- fan06 → supporter #6,  ~3.4 weeks early
  ('a0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '24 days'),
  -- fan07 → supporter #7,  ~3.0 weeks early
  ('a0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '21 days'),
  -- fan08 → supporter #8,  ~2.6 weeks early
  ('a0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '18 days'),
  -- fan09 → supporter #9,  ~2.0 weeks early
  ('a0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '14 days'),

  -- ── Pile-on wave — voted in the last 7 days (pushing over both bars)
  -- fan10 → supporter #10, ~1.0 week early
  ('a0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '7 days'),
  -- fan11 → supporter #11, ~0.9 weeks early
  ('a0000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '6 days'),
  -- fan12 → supporter #12
  ('a0000000-0000-0000-0000-000000000015', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '5 days 18 hours'),
  -- fan13 → supporter #13
  ('a0000000-0000-0000-0000-000000000016', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '5 days 6 hours'),
  -- fan14 → supporter #14
  ('a0000000-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '4 days 20 hours'),
  -- fan15 → supporter #15
  ('a0000000-0000-0000-0000-000000000018', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '4 days 8 hours'),
  -- fan16 → supporter #16
  ('a0000000-0000-0000-0000-000000000019', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '3 days 18 hours'),
  -- fan17 → supporter #17
  ('a0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '3 days 6 hours'),
  -- fan18 → supporter #18
  ('a0000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '2 days 16 hours'),
  -- fan19 → supporter #19
  ('a0000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '2 days 4 hours'),
  -- fan20 → supporter #20
  ('a0000000-0000-0000-0000-000000000023', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '1 day 20 hours'),
  -- fan21 → supporter #21
  ('a0000000-0000-0000-0000-000000000024', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '1 day 6 hours'),
  -- fan22 → supporter #22
  ('a0000000-0000-0000-0000-000000000025', 'e0000000-0000-0000-0000-000000000001', 'vote', 3.0, NOW() - INTERVAL '18 hours'),

  -- ── tochi / ama / scout1 — also voted recently (supporters #23–25)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'vote',  3.0, NOW() - INTERVAL '5 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'vote',  3.0, NOW() - INTERVAL '3 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'vote',  4.5, NOW() - INTERVAL '1 day'),

  -- ── Reactions + shares on Dré (visible fire count + pulse boost)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'react', 1.0, NOW() - INTERVAL '5 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'react', 1.0, NOW() - INTERVAL '2 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'react', 1.5, NOW() - INTERVAL '10 hours'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'share', 4.0, NOW() - INTERVAL '4 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'share', 6.0, NOW() - INTERVAL '2 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'share', 4.0, NOW() - INTERVAL '8 hours'),

  -- ════════════════════════════════════════════════════════════════════════════
  -- REMAINING ARTISTS — pre-ignition (≤3 distinct backers each)
  -- None come close to the 20-backer bar. All shown as rising/flat on feed.
  -- ════════════════════════════════════════════════════════════════════════════

  -- ── Zola "Cold Season" — rising (2 votes + 2 shares + 2 reacts)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'vote',  3.0, NOW() - INTERVAL '4 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'vote',  4.5, NOW() - INTERVAL '18 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'share', 4.0, NOW() - INTERVAL '3 days'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'share', 4.0, NOW() - INTERVAL '12 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'react', 1.0, NOW() - INTERVAL '4 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'react', 1.5, NOW() - INTERVAL '6 hours'),

  -- ── Mo Vibez "Overtime" — some momentum (2 votes + 1 share + 2 reacts)
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'vote',  3.0, NOW() - INTERVAL '4 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'vote',  4.5, NOW() - INTERVAL '2 days'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'share', 4.0, NOW() - INTERVAL '1 day'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'react', 1.0, NOW() - INTERVAL '3 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'react', 1.0, NOW() - INTERVAL '20 hours'),

  -- ── Echo "Echo Chamber" — slight uptick (1 vote + 1 share + 2 reacts)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'vote',  3.0, NOW() - INTERVAL '3 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004', 'share', 6.0, NOW() - INTERVAL '2 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 'react', 1.0, NOW() - INTERVAL '3 days'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'react', 1.0, NOW() - INTERVAL '28 hours'),

  -- ── K-Dark "Dark Hours" — minimal (1 vote + 1 react, older → shows —)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'vote',  3.0, NOW() - INTERVAL '5 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005', 'react', 1.0, NOW() - INTERVAL '4 days'),

  -- ── Temi Waves "Wavelength" — minimal (1 vote + 1 react, older)
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000006', 'vote',  3.0, NOW() - INTERVAL '5 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000006', 'react', 1.5, NOW() - INTERVAL '4 days'),

  -- ── ABJ Gold "Gold Standard" — barely any (1 react only)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000007', 'react', 1.0, NOW() - INTERVAL '3 days'),

  -- ── Seer "Vision" — barely any (1 react only)
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000008', 'react', 1.0, NOW() - INTERVAL '2 days'),

  -- ── Nova "First Light" — fresh drop, cold-start bonus active (3 reacts)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000009', 'react', 1.0, NOW() - INTERVAL '35 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000009', 'react', 1.0, NOW() - INTERVAL '30 hours'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000009', 'react', 1.5, NOW() - INTERVAL '20 hours'),

  -- ── Rue "Rue the Day" — freshest drop (2 reacts)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000010', 'react', 1.0, NOW() - INTERVAL '18 hours'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000010', 'react', 1.5, NOW() - INTERVAL '10 hours')

ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES — run these manually after seed + recompute_pulse()
-- =============================================================================

-- 1. Confirm user rows
-- SELECT id, handle, is_anonymous, taste_trust FROM users ORDER BY handle;

-- 2. Engagement totals per artist (Dré should be far ahead)
-- SELECT a.name,
--        COUNT(DISTINCT ee.user_id) FILTER (WHERE ee.kind='vote') AS distinct_backers,
--        COALESCE(SUM(ee.weight) FILTER (WHERE ee.kind='vote'), 0) AS vote_weight
-- FROM engagement_events ee
-- JOIN tracks t ON t.id = ee.track_id
-- JOIN artists a ON a.id = t.artist_id
-- GROUP BY a.name ORDER BY vote_weight DESC;

-- 3. Fire recompute, then check rankings
-- SELECT public.recompute_pulse();
-- SELECT r.rank, t.title, a.name, a.ignited_at IS NOT NULL AS ignited,
--        ROUND(r.pulse::numeric,2) AS pulse, ROUND(r.momentum::numeric,3) AS momentum
-- FROM rankings r JOIN tracks t ON t.id=r.track_id JOIN artists a ON a.id=t.artist_id
-- WHERE r.bucket='nigeria' ORDER BY r.rank;

-- 4. Confirm exactly ONE ignition
-- SELECT name, ignited_at FROM artists WHERE ignited_at IS NOT NULL;

-- 5. Inspect the supporter ledger (fan01 should be #1, ~8 weeks early)
-- SELECT u.handle, sl.supporter_rank, sl.weeks_early
-- FROM supporter_ledger sl
-- JOIN users u ON u.id = sl.user_id
-- JOIN artists a ON a.id = sl.artist_id
-- WHERE a.slug = 'dre-ph'
-- ORDER BY sl.supporter_rank;

-- 6. Get a fan-card URL for the top early backer (fan01)
-- SELECT '/api/card/fan/' || sl.id AS fan_card_url
-- FROM supporter_ledger sl
-- JOIN users u ON u.id = sl.user_id
-- WHERE u.handle = 'fan01';
