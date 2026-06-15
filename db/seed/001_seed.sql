-- =============================================================================
-- STREETS — Phase 1: Dev Seed
-- Idempotent (ON CONFLICT DO NOTHING everywhere).
-- Run in Supabase SQL Editor AFTER all migrations.
--
-- Creates:
--   • 3 seed users in auth.users (triggers handle_new_auth_user → public.users)
--   • 2 genres, 2 cities
--   • 10 artists + 10 tracks
--   • Synthetic engagement events (varied timestamps) so recompute_pulse()
--     has something to work with
--   • One artist ("Dré") gets enough trust-weighted votes to cross Ignition
-- =============================================================================

-- ─── Seed UUIDs (fixed so the seed is deterministic) ─────────────────────────
-- Users
-- seed-user-1: 'a0000000-0000-0000-0000-000000000001'
-- seed-user-2: 'a0000000-0000-0000-0000-000000000002'
-- seed-user-3: 'a0000000-0000-0000-0000-000000000003'

-- ─── Step 0: Ensure pgcrypto is available ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Step 1: Auth users ───────────────────────────────────────────────────────
-- Inserted directly into auth.users via service-role access (SQL Editor only).
-- This triggers handle_new_auth_user() which creates public.users rows.
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

-- Patch public.users rows to be non-anonymous (trigger may have fired before email confirm)
UPDATE public.users SET is_anonymous = false, taste_trust = 1.0
WHERE id IN (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003'
);

-- Set handles
UPDATE public.users SET handle = 'tochi'  WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.users SET handle = 'ama'    WHERE id = 'a0000000-0000-0000-0000-000000000002';
UPDATE public.users SET handle = 'scout1' WHERE id = 'a0000000-0000-0000-0000-000000000003';

-- Give the scout a higher trust score (simulates earned reputation)
UPDATE public.users SET taste_trust = 1.5
WHERE id = 'a0000000-0000-0000-0000-000000000003';

-- ─── Step 2: Genres ───────────────────────────────────────────────────────────
INSERT INTO genres (id, name, slug) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Afrobeats',  'afrobeats'),
  ('b0000000-0000-0000-0000-000000000002', 'Alté',       'alte'),
  ('b0000000-0000-0000-0000-000000000003', 'Afro-Pop',   'afro-pop'),
  ('b0000000-0000-0000-0000-000000000004', 'Street-Pop', 'street-pop')
ON CONFLICT (id) DO NOTHING;

-- ─── Step 3: Cities ───────────────────────────────────────────────────────────
INSERT INTO cities (id, name, slug, country) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Port Harcourt', 'port-harcourt', 'NG'),
  ('c0000000-0000-0000-0000-000000000002', 'Lagos',         'lagos',         'NG'),
  ('c0000000-0000-0000-0000-000000000003', 'Abuja',         'abuja',         'NG')
ON CONFLICT (slug) DO NOTHING;

-- ─── Step 4: Artists (10) ────────────────────────────────────────────────────
INSERT INTO artists (id, slug, name, city_id, created_at) VALUES
  -- PH underground (will ignite via seed votes below)
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
  -- Fresh drops (< 72h — will appear in 'fresh' bucket)
  ('d0000000-0000-0000-0000-000000000009', 'nova-ph',     'Nova',       'c0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '40 hours'),
  ('d0000000-0000-0000-0000-000000000010', 'rue-lagos',   'Rue',        'c0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '20 hours')
ON CONFLICT (id) DO NOTHING;

-- ─── Step 5: Tracks (one per artist) ─────────────────────────────────────────
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

  -- Fresh tracks (< 72h) — appear in 'fresh' bucket immediately
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

-- ─── Step 6: Synthetic engagement events ─────────────────────────────────────
-- Weights are pre-computed (base_weight × taste_trust) as they would be at
-- write time. Trust: tochi=1.0, ama=1.0, scout1=1.5
--
-- Dré (d...001 / e...001) gets the most engagement → should rank #1 + ignite.
-- Zola, Mo, Echo get medium engagement → rank 2–4.
-- The rest get light engagement.
-- Nova + Rue get only a couple of reactions (fresh, no votes yet).

INSERT INTO engagement_events (user_id, track_id, kind, weight, created_at)
VALUES

  -- ── Dré "No Pressure" — heavy engagement over past 3 weeks ─────────────────
  -- Votes (weight = 3 × trust)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'vote',  3.0,  NOW() - INTERVAL '28 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'vote',  3.0,  NOW() - INTERVAL '20 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'vote',  4.5,  NOW() - INTERVAL '14 days'),
  -- Reactions (weight = 1 × trust)
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'react', 1.0,  NOW() - INTERVAL '27 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'react', 1.0,  NOW() - INTERVAL '19 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'react', 1.5,  NOW() - INTERVAL '13 days'),
  -- Shares (weight = 4 × trust) — recent, so they contribute heavily to hottest
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'share', 4.0,  NOW() - INTERVAL '5 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'share', 6.0,  NOW() - INTERVAL '2 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'share', 4.0,  NOW() - INTERVAL '6 hours'),

  -- ── Zola "Cold Season" — strong engagement ───────────────────────────────
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'vote',  3.0,  NOW() - INTERVAL '23 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'vote',  4.5,  NOW() - INTERVAL '10 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'react', 1.0,  NOW() - INTERVAL '22 days'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'share', 4.0,  NOW() - INTERVAL '4 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'share', 4.0,  NOW() - INTERVAL '1 day'),

  -- ── Mo Vibez "Overtime" ───────────────────────────────────────────────────
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'vote',  3.0,  NOW() - INTERVAL '18 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'vote',  4.5,  NOW() - INTERVAL '7 days'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'react', 1.0,  NOW() - INTERVAL '17 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'share', 4.0,  NOW() - INTERVAL '3 days'),

  -- ── Echo "Echo Chamber" ───────────────────────────────────────────────────
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'vote',  3.0,  NOW() - INTERVAL '13 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004', 'vote',  4.5,  NOW() - INTERVAL '5 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 'react', 1.0,  NOW() - INTERVAL '12 days'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'share', 4.0,  NOW() - INTERVAL '2 days'),

  -- ── K-Dark, Temi Waves, ABJ Gold — light engagement ─────────────────────
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 'vote',  3.0,  NOW() - INTERVAL '10 days'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005', 'react', 1.0,  NOW() - INTERVAL '9 days'),

  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000006', 'vote',  3.0,  NOW() - INTERVAL '9 days'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000006', 'react', 1.5,  NOW() - INTERVAL '8 days'),

  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000007', 'vote',  4.5,  NOW() - INTERVAL '6 days'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000007', 'react', 1.0,  NOW() - INTERVAL '5 days'),

  -- ── Seer "Vision" — light ────────────────────────────────────────────────
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000008', 'vote',  3.0,  NOW() - INTERVAL '5 days'),
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000008', 'react', 1.0,  NOW() - INTERVAL '4 days'),

  -- ── Nova + Rue — fresh drops, reactions only so far ──────────────────────
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000009', 'react', 1.0,  NOW() - INTERVAL '35 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000009', 'react', 1.0,  NOW() - INTERVAL '30 hours'),

  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000010', 'react', 1.5,  NOW() - INTERVAL '18 hours')

ON CONFLICT DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- Run these manually to confirm the seed is healthy
-- =============================================================================

-- 1. Check user rows
-- SELECT id, handle, is_anonymous, taste_trust FROM users ORDER BY handle;

-- 2. Check tracks + artists
-- SELECT a.name, t.title, t.created_at FROM tracks t JOIN artists a ON a.id = t.artist_id ORDER BY t.created_at;

-- 3. Check engagement totals per artist
-- SELECT a.name, COUNT(*) AS events, SUM(ee.weight) AS total_weight
-- FROM engagement_events ee
-- JOIN tracks t ON t.id = ee.track_id
-- JOIN artists a ON a.id = t.artist_id
-- GROUP BY a.name ORDER BY total_weight DESC;

-- 4. Run pulse recompute and check rankings
-- SELECT public.recompute_pulse();
-- SELECT r.rank, t.title, a.name, ROUND(r.pulse::numeric, 2) AS pulse, ROUND(r.momentum::numeric, 3) AS momentum
-- FROM rankings r JOIN tracks t ON t.id = r.track_id JOIN artists a ON a.id = t.artist_id
-- WHERE r.bucket = 'nigeria' ORDER BY r.rank;

-- 5. Check ignition + ledger
-- SELECT name, ignited_at FROM artists WHERE ignited_at IS NOT NULL;
-- SELECT u.handle, a.name, sl.supporter_rank, sl.weeks_early
-- FROM supporter_ledger sl JOIN users u ON u.id = sl.user_id JOIN artists a ON a.id = sl.artist_id
-- ORDER BY a.name, sl.supporter_rank;
