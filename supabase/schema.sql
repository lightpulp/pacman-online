-- Run this whole script in Supabase -> SQL Editor -> New query.

create table if not exists public.students (
  student_id    text primary key
                check (student_id ~ '^[0-9]{2}-[0-9]{4}-[0-9]{3}$'),
  name          text not null check (char_length(name) between 2 and 40),
  token         uuid not null default gen_random_uuid(),  -- secret kept in the player's browser, needed to submit scores
  best_score    integer not null default 0 check (best_score >= 0),
  best_score_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Every finished game (full history). The leaderboard only reads students.best_score.
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  score      integer not null check (score >= 0 and score <= 20000),
  won        boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists students_leaderboard_idx
  on public.students (best_score desc, best_score_at asc);
create index if not exists scores_student_time_idx
  on public.scores (student_id, created_at desc);

-- Lock the tables down: only the server (service role key) can touch them.
alter table public.students enable row level security;
alter table public.scores   enable row level security;
revoke all on public.students from anon, authenticated;
revoke all on public.scores   from anon, authenticated;

-- Atomic score submission: verifies token, caps score, rate-limits, updates best score.
create or replace function public.submit_score(
  p_student_id text, p_token uuid, p_score integer, p_won boolean
)
returns table (out_best integer, out_new_best boolean, out_rank integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best integer;
  v_new  boolean := false;
begin
  select st.best_score into v_best
    from public.students st
   where st.student_id = p_student_id and st.token = p_token
   for update;
  if not found then raise exception 'invalid_student'; end if;

  if p_score < 0 or p_score > 20000 or p_score % 10 <> 0 then
    raise exception 'invalid_score';
  end if;

  if exists (select 1 from public.scores sc
              where sc.student_id = p_student_id
                and sc.created_at > now() - interval '20 seconds') then
    raise exception 'rate_limited';
  end if;

  insert into public.scores (student_id, score, won) values (p_student_id, p_score, p_won);

  if p_score > v_best then
    update public.students
       set best_score = p_score, best_score_at = now()
     where student_id = p_student_id;
    v_best := p_score;
    v_new  := true;
  end if;

  return query
    select v_best, v_new,
           (select count(*)::integer + 1 from public.students s2 where s2.best_score > v_best);
end;
$$;

revoke all on function public.submit_score(text, uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.submit_score(text, uuid, integer, boolean) to service_role;
