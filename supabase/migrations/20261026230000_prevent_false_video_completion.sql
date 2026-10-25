create or replace function public.save_video_session(
  p_session_id text,
  p_video_id text,
  p_watched_seconds integer,
  p_duration integer,
  p_last_time integer,
  p_opened_at timestamp without time zone,
  p_completed boolean default false,
  p_skips integer default 0
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_auth_id uuid;
  v_email text;
  v_phone text;
  v_student record;
  v_duration integer;
  v_watched integer;
  v_percent real;
  v_completed boolean;
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

  -- Reaching the final timestamp is not proof that the lesson was watched.
  -- Only a client-confirmed full-coverage completion can produce 100%.
  v_completed := coalesce(p_completed, false)
    and v_duration > 0
    and v_watched >= v_duration;

  v_percent := case
    when v_duration <= 0 then 0::real
    when v_completed then 100::real
    else least(99.9::real, greatest(0::real, (v_watched::real / v_duration::real) * 100))
  end;

  insert into public.video_sessions (
    student_id, video_id, class_group, watched_seconds, duration, last_time,
    first_opened_at, last_opened_at,
    percent, progress, completed, skips, updated_at
  )
  values (
    v_student.id, p_video_id, v_student.class_group, v_watched, v_duration,
    greatest(0, least(coalesce(p_last_time, 0), v_duration)),
    p_opened_at, p_opened_at,
    v_percent, floor(v_percent)::integer, v_completed,
    greatest(0, coalesce(p_skips, 0)), pg_catalog.now()
  )
  on conflict (student_id, video_id) do update set
    class_group = excluded.class_group,
    duration = greatest(coalesce(public.video_sessions.duration, 0), excluded.duration),
    watched_seconds = greatest(coalesce(public.video_sessions.watched_seconds, 0), excluded.watched_seconds),
    last_time = case
      when excluded.last_opened_at >= coalesce(public.video_sessions.last_opened_at, excluded.last_opened_at)
      then excluded.last_time
      else coalesce(public.video_sessions.last_time, excluded.last_time)
    end,
    first_opened_at = coalesce(public.video_sessions.first_opened_at, excluded.first_opened_at),
    last_opened_at = greatest(
      coalesce(public.video_sessions.last_opened_at, excluded.last_opened_at),
      excluded.last_opened_at
    ),
    percent = greatest(coalesce(public.video_sessions.percent, 0), coalesce(public.video_sessions.progress, 0), excluded.percent),
    progress = greatest(coalesce(public.video_sessions.progress, 0), floor(coalesce(public.video_sessions.percent, 0))::integer, excluded.progress),
    completed = coalesce(public.video_sessions.completed, false) or excluded.completed,
    skips = greatest(coalesce(public.video_sessions.skips, 0), excluded.skips),
    updated_at = pg_catalog.now();

  return pg_catalog.json_build_object(
    'success', true,
    'watched_seconds', v_watched,
    'duration', v_duration,
    'percent', round(v_percent::numeric, 1),
    'completed', v_completed
  );
end;
$function$;
