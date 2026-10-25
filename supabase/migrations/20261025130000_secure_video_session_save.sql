-- Video progress tracking repair
-- Additive RPC first; direct INSERT/UPDATE policies are removed only after
-- writes are routed through this authenticated, active-session-checked RPC.
-- Existing video_sessions rows are retained.

alter table public.video_sessions add column if not exists last_time integer not null default 0;

create unique index if not exists video_sessions_student_video_uidx
  on public.video_sessions (student_id, video_id);

drop function if exists public.save_video_session(text, text, integer, integer, integer, boolean, integer);

create function public.save_video_session(
  p_session_id text,
  p_video_id text,
  p_watched_seconds integer,
  p_duration integer,
  p_last_time integer,
  p_completed boolean default false,
  p_skips integer default 0
)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth_id uuid;
  v_email text;
  v_phone text;
  v_student record;
  v_duration integer;
  v_watched integer;
  v_percent real;
begin
  v_auth_id := auth.uid();
  if v_auth_id is null then
    return pg_catalog.json_build_object('success', false, 'reason', 'not_authenticated');
  end if;

  if p_session_id is null or pg_catalog.length(p_session_id) < 8 then
    return pg_catalog.json_build_object('success', false, 'reason', 'session_invalid');
  end if;

  select u.email into v_email
  from auth.users as u
  where u.id = v_auth_id;

  if v_email is null or pg_catalog.right(pg_catalog.lower(v_email), 10) <> '@phone.com' then
    return pg_catalog.json_build_object('success', false, 'reason', 'student_not_found');
  end if;

  v_phone := pg_catalog.split_part(v_email, '@', 1);

  select s.id, s.phone, s.activated, s.class_group
    into v_student
  from public.students as s
  where s.phone = v_phone
  limit 1;

  if not found or coalesce(v_student.activated, false) is false then
    return pg_catalog.json_build_object('success', false, 'reason', 'student_not_activated');
  end if;

  if not exists (
    select 1
    from public.active_sessions as a
    where a.auth_user_id = v_auth_id
      and a.session_id = p_session_id
      and a.last_seen_at >= pg_catalog.now() - interval '5 minutes'
  ) then
    return pg_catalog.json_build_object('success', false, 'reason', 'session_invalid');
  end if;

  if p_video_id is null or not exists (
    select 1 from public.videos as v where v.id::text = p_video_id
  ) then
    return pg_catalog.json_build_object('success', false, 'reason', 'video_not_found');
  end if;

  v_duration := greatest(0, coalesce(p_duration, 0));
  v_watched := greatest(0, least(coalesce(p_watched_seconds, 0), v_duration));
  v_percent := case when v_duration > 0
    then least(100::real, greatest(0::real, (v_watched::real / v_duration::real) * 100))
    else 0::real
  end;

  insert into public.video_sessions (
    student_id, video_id, class_group, watched_seconds, duration, last_time,
    percent, progress, completed, skips, updated_at
  )
  values (
    v_student.id, p_video_id, v_student.class_group, v_watched, v_duration,
    greatest(0, least(coalesce(p_last_time, 0), v_duration)),
    v_percent, round(v_percent)::integer,
    coalesce(p_completed, false) or v_percent >= 95,
    greatest(0, coalesce(p_skips, 0)), pg_catalog.now()
  )
  on conflict (student_id, video_id) do update set
    class_group = excluded.class_group,
    watched_seconds = excluded.watched_seconds,
    duration = excluded.duration,
    last_time = excluded.last_time,
    percent = excluded.percent,
    progress = excluded.progress,
    completed = excluded.completed,
    skips = excluded.skips,
    updated_at = pg_catalog.now();

  return pg_catalog.json_build_object(
    'success', true,
    'watched_seconds', v_watched,
    'duration', v_duration,
    'percent', round(v_percent::numeric, 1)
  );
end;
$function$;

revoke all on function public.save_video_session(text, text, integer, integer, integer, boolean, integer) from public;
revoke all on function public.save_video_session(text, text, integer, integer, integer, boolean, integer) from anon;
grant execute on function public.save_video_session(text, text, integer, integer, integer, boolean, integer) to authenticated;

-- Keep existing policies unchanged until the RPC has been verified with a real
-- authenticated student session. Remove legacy write policies in a follow-up
-- migration after the end-to-end test succeeds.
