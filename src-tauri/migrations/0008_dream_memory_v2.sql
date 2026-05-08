-- Dream Memory v2: structured, versioned memory metadata and dreaming audit tables.
--
-- This migration is additive only. Existing memory ids, content, embeddings, and
-- character ownership are preserved so upgrades never clear user memory.

ALTER TABLE memories ADD COLUMN memory_type TEXT NOT NULL DEFAULT 'legacy_fact';
ALTER TABLE memories ADD COLUMN entity_key TEXT;
ALTER TABLE memories ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE memories ADD COLUMN confidence REAL NOT NULL DEFAULT 0.6;
ALTER TABLE memories ADD COLUMN first_seen_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN evidence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE memories ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE memories ADD COLUMN source_refs TEXT NOT NULL DEFAULT '[]';
ALTER TABLE memories ADD COLUMN supersedes TEXT;
ALTER TABLE memories ADD COLUMN canonical_hash TEXT;
ALTER TABLE memories ADD COLUMN last_dreamed_at INTEGER;

UPDATE memories
SET
    first_seen_at = CASE WHEN first_seen_at = 0 THEN created_at ELSE first_seen_at END,
    last_seen_at = CASE
        WHEN last_seen_at = 0 AND updated_at > created_at THEN updated_at
        WHEN last_seen_at = 0 THEN created_at
        ELSE last_seen_at
    END,
    canonical_hash = CASE
        WHEN canonical_hash IS NULL OR canonical_hash = '' THEN lower(trim(content))
        ELSE canonical_hash
    END
WHERE first_seen_at = 0
   OR last_seen_at = 0
   OR canonical_hash IS NULL
   OR canonical_hash = '';

CREATE INDEX IF NOT EXISTS idx_memories_character_status_created
    ON memories(character_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_character_entity_active
    ON memories(character_id, memory_type, entity_key, status);

CREATE INDEX IF NOT EXISTS idx_memories_character_canonical
    ON memories(character_id, canonical_hash, status);

CREATE TABLE IF NOT EXISTS memory_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    content TEXT NOT NULL,
    memory_type TEXT NOT NULL DEFAULT 'fact',
    entity_key TEXT,
    importance REAL NOT NULL DEFAULT 0.5,
    confidence REAL NOT NULL DEFAULT 0.6,
    canonical_hash TEXT NOT NULL,
    source_kind TEXT NOT NULL DEFAULT 'extractor',
    source_refs TEXT NOT NULL DEFAULT '[]',
    decision TEXT NOT NULL DEFAULT 'pending',
    applied_memory_id INTEGER,
    created_at INTEGER NOT NULL,
    decided_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_memory_candidates_character_decision
    ON memory_candidates(character_id, decision, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER,
    candidate_id INTEGER,
    character_id TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_ref TEXT,
    excerpt TEXT NOT NULL DEFAULT '',
    rationale TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_evidence_memory
    ON memory_evidence(memory_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_dream_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    status TEXT NOT NULL,
    trigger TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    auto_applied_count INTEGER NOT NULL DEFAULT 0,
    proposal_count INTEGER NOT NULL DEFAULT 0,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_memory_dream_jobs_character_started
    ON memory_dream_jobs(character_id, started_at DESC);

CREATE TABLE IF NOT EXISTS memory_dream_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    proposal_type TEXT NOT NULL,
    status TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.0,
    title TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    source_memory_ids TEXT NOT NULL DEFAULT '[]',
    target_memory_id INTEGER,
    proposed_content TEXT,
    proposed_memory_type TEXT,
    proposed_entity_key TEXT,
    impact TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    applied_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_memory_dream_proposals_character_status
    ON memory_dream_proposals(character_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    memory_id INTEGER,
    proposal_id INTEGER,
    before_json TEXT,
    after_json TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_operations_character_created
    ON memory_operations(character_id, created_at DESC);
