-- Cache for search responses to reduce repeat RPC calls.
CREATE TABLE IF NOT EXISTS search_cache (
  cache_key text PRIMARY KEY,
  response jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache (expires_at);

-- Cache for publicly visible provider profiles.
CREATE TABLE IF NOT EXISTS service_cache (
  service_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);
