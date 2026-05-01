-- ============================================================================
-- Password reset tokens for the custom-auth login flow.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token       text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_token   on password_reset_tokens(token);
create index if not exists idx_password_reset_tokens_user    on password_reset_tokens(user_id);
create index if not exists idx_password_reset_tokens_expires on password_reset_tokens(expires_at);

-- Match the project-wide pattern: RLS enabled + permissive policy so the
-- anon-key browser client can read/write through the existing custom-auth flow.
alter table password_reset_tokens enable row level security;

do $$
begin
  create policy "Allow all" on password_reset_tokens
    for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
