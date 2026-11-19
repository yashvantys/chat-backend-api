
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- USERS
-- =========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================
-- CHATS
-- =========================================
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  type TEXT NOT NULL DEFAULT 'direct'
    CHECK (type IN ('direct', 'group')),

  direct_key TEXT UNIQUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_direct_chat_key
    CHECK (
      (type = 'direct' AND direct_key IS NOT NULL)
      OR
      (type = 'group' AND direct_key IS NULL)
    )
);

-- =========================================
-- CHAT MEMBERS
-- =========================================
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id UUID NOT NULL
    REFERENCES chats(id) ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (chat_id, user_id)
);

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX IF NOT EXISTS idx_chat_members_user
  ON chat_members(user_id);

CREATE INDEX IF NOT EXISTS idx_chats_created_at
  ON chats(created_at DESC);

-- =========================================
-- SAMPLE USERS
-- =========================================
INSERT INTO users (id, name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Alice'),
  ('22222222-2222-4222-8222-222222222222', 'Bob'),
  ('33333333-3333-4333-8333-333333333333', 'Carol')
ON CONFLICT (id) DO NOTHING;
