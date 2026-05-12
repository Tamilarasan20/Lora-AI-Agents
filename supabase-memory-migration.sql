-- ═══════════════════════════════════════════════════════════════════════════
-- Loraloop Memory Layer — Phase 1 migration
-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER supabase-migration.sql.
-- Creates the 5-layer memory model from docs/architecture/MEMORY.md.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type memory_layer as enum ('brand', 'campaign', 'strategic', 'preference', 'reflection');
exception when duplicate_object then null; end $$;

do $$ begin
  create type memory_event_kind as enum ('add', 'update', 'delete', 'noop');
exception when duplicate_object then null; end $$;

-- ── Core: atomic memory facts (Mem0-style) ─────────────────────────────────
create table if not exists memories (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  user_id         uuid,
  layer           memory_layer not null,
  agent_scope     text not null default 'shared',
  content         text not null,
  source_type     text,
  source_id       uuid,
  metadata        jsonb not null default '{}'::jsonb,
  embedding       vector(768),
  importance      smallint not null default 5 check (importance between 1 and 10),
  confidence      real not null default 1.0 check (confidence between 0 and 1),
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  superseded_by   uuid references memories(id),
  tsv             tsvector generated always as (to_tsvector('english', content)) stored
);

-- ── Document memory (Supermemory-style chunked source material) ────────────
create table if not exists memory_documents (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  title           text not null,
  source_url      text,
  source_type     text not null default 'web',
  raw_uri         text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists memory_chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references memory_documents(id) on delete cascade,
  workspace_id    uuid not null,
  chunk_index     int not null,
  parent_chunk_id uuid references memory_chunks(id),
  content         text not null,
  embedding       vector(768),
  metadata        jsonb not null default '{}'::jsonb,
  tsv             tsvector generated always as (to_tsvector('english', content)) stored,
  created_at      timestamptz not null default now()
);

-- ── Entity graph (Mem0-style relationships on Postgres) ────────────────────
create table if not exists memory_entities (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  name            text not null,
  kind            text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (workspace_id, name, kind)
);

create table if not exists memory_relations (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null,
  subject_id          uuid not null references memory_entities(id) on delete cascade,
  predicate           text not null,
  object_id           uuid not null references memory_entities(id) on delete cascade,
  evidence_memory_id  uuid references memories(id) on delete set null,
  weight              real not null default 1.0,
  created_at          timestamptz not null default now()
);

-- ── Event log (every memory mutation, for audit + reflection) ──────────────
create table if not exists memory_events (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  memory_id       uuid references memories(id) on delete set null,
  agent           text,
  kind            memory_event_kind not null,
  delta           jsonb,
  created_at      timestamptz not null default now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
create index if not exists memories_workspace_layer_idx
  on memories (workspace_id, layer) where superseded_by is null;

create index if not exists memories_agent_scope_idx
  on memories (workspace_id, agent_scope) where superseded_by is null;

create index if not exists memories_embedding_hnsw
  on memories using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

create index if not exists memories_tsv_gin
  on memories using gin (tsv);

create index if not exists memories_metadata_gin
  on memories using gin (metadata jsonb_path_ops);

create index if not exists memory_chunks_embedding_hnsw
  on memory_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists memory_chunks_tsv_gin
  on memory_chunks using gin (tsv);

create index if not exists memory_chunks_doc_idx
  on memory_chunks (document_id, chunk_index);

create index if not exists memory_entities_workspace_idx
  on memory_entities (workspace_id, name);

create index if not exists memory_events_workspace_idx
  on memory_events (workspace_id, created_at desc);

-- ── Hybrid retrieval RPC ───────────────────────────────────────────────────
create or replace function memories_hybrid_search(
  workspace_id_in   uuid,
  query_text        text,
  query_embedding   vector(768),
  layers_in         memory_layer[] default null,
  scopes_in         text[]         default null,
  min_importance    int            default 1,
  time_window_days  int            default null,
  candidate_n       int            default 50
)
returns table (
  id           uuid,
  content      text,
  metadata     jsonb,
  layer        memory_layer,
  agent_scope  text,
  importance   smallint,
  confidence   real,
  created_at   timestamptz,
  score        real,
  source       text
)
language sql stable
as $$
  with vec as (
    select
      m.id, m.content, m.metadata, m.layer, m.agent_scope,
      m.importance, m.confidence, m.created_at,
      (1 - (m.embedding <=> query_embedding))::real as vscore,
      'vector'::text as src
    from memories m
    where m.workspace_id = workspace_id_in
      and m.superseded_by is null
      and m.importance >= min_importance
      and m.embedding is not null
      and (layers_in is null or m.layer = any(layers_in))
      and (scopes_in is null or m.agent_scope = any(scopes_in))
      and (time_window_days is null
           or m.created_at >= now() - (time_window_days || ' days')::interval)
    order by m.embedding <=> query_embedding
    limit candidate_n
  ),
  bm as (
    select
      m.id, m.content, m.metadata, m.layer, m.agent_scope,
      m.importance, m.confidence, m.created_at,
      ts_rank(m.tsv, plainto_tsquery('english', query_text))::real as vscore,
      'bm25'::text as src
    from memories m
    where m.workspace_id = workspace_id_in
      and m.superseded_by is null
      and m.importance >= min_importance
      and m.tsv @@ plainto_tsquery('english', query_text)
      and (layers_in is null or m.layer = any(layers_in))
      and (scopes_in is null or m.agent_scope = any(scopes_in))
      and (time_window_days is null
           or m.created_at >= now() - (time_window_days || ' days')::interval)
    order by vscore desc
    limit candidate_n
  ),
  fused as (
    select * from vec
    union all
    select * from bm
  )
  select
    id, content, metadata, layer, agent_scope, importance, confidence, created_at,
    max(vscore) as score,
    string_agg(distinct src, '+' order by src) as source
  from fused
  group by id, content, metadata, layer, agent_scope, importance, confidence, created_at
  order by max(vscore) desc
  limit candidate_n;
$$;

-- ── Chunk retrieval RPC (mirrors memories but for memory_chunks) ───────────
create or replace function memory_chunks_hybrid_search(
  workspace_id_in   uuid,
  query_text        text,
  query_embedding   vector(768),
  candidate_n       int default 30
)
returns table (
  id           uuid,
  document_id  uuid,
  content      text,
  metadata     jsonb,
  chunk_index  int,
  score        real,
  source       text
)
language sql stable
as $$
  with vec as (
    select c.id, c.document_id, c.content, c.metadata, c.chunk_index,
           (1 - (c.embedding <=> query_embedding))::real as vscore,
           'vector'::text as src
    from memory_chunks c
    where c.workspace_id = workspace_id_in
      and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit candidate_n
  ),
  bm as (
    select c.id, c.document_id, c.content, c.metadata, c.chunk_index,
           ts_rank(c.tsv, plainto_tsquery('english', query_text))::real as vscore,
           'bm25'::text as src
    from memory_chunks c
    where c.workspace_id = workspace_id_in
      and c.tsv @@ plainto_tsquery('english', query_text)
    order by vscore desc
    limit candidate_n
  ),
  fused as (
    select * from vec
    union all
    select * from bm
  )
  select id, document_id, content, metadata, chunk_index,
         max(vscore) as score,
         string_agg(distinct src, '+' order by src) as source
  from fused
  group by id, document_id, content, metadata, chunk_index
  order by max(vscore) desc
  limit candidate_n;
$$;

-- ── Row-Level Security ─────────────────────────────────────────────────────
alter table memories         enable row level security;
alter table memory_documents enable row level security;
alter table memory_chunks    enable row level security;
alter table memory_entities  enable row level security;
alter table memory_relations enable row level security;
alter table memory_events    enable row level security;

-- Policy template: the application enforces workspace membership through the
-- billing_users join. If you have a `workspace_members` table substitute it
-- in for `billing_users` below.
do $$ begin
  create policy memories_workspace_isolation on memories
    for all using (
      workspace_id in (select id from billing_users where auth_user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy memory_documents_workspace_isolation on memory_documents
    for all using (
      workspace_id in (select id from billing_users where auth_user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy memory_chunks_workspace_isolation on memory_chunks
    for all using (
      workspace_id in (select id from billing_users where auth_user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy memory_entities_workspace_isolation on memory_entities
    for all using (
      workspace_id in (select id from billing_users where auth_user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy memory_relations_workspace_isolation on memory_relations
    for all using (
      workspace_id in (select id from billing_users where auth_user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy memory_events_workspace_isolation on memory_events
    for all using (
      workspace_id in (select id from billing_users where auth_user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

-- ── End of migration ───────────────────────────────────────────────────────
