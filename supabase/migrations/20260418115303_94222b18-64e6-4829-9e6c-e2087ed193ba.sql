-- Enable pgvector
create extension if not exists vector;

-- Add embedding column (768 dims for text-embedding-004)
alter table public.document_chunks
  add column if not exists embedding vector(768);

-- HNSW cosine index
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- RPC for semantic search
create or replace function public.match_chunks(
  query_embedding vector(768),
  match_count int default 5,
  similarity_threshold float default 0.5
)
returns table (
  id uuid,
  content text,
  document_id uuid,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dc.id,
    dc.content,
    dc.document_id,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;