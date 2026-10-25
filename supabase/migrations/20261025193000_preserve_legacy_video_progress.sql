-- Ensure legacy progress values are not lost when percent was previously NULL.
do $sync$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(p.oid)
    into v_definition
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'save_video_session';

  if v_definition is null then
    raise exception 'save_video_session function not found';
  end if;

  v_definition := pg_catalog.replace(
    v_definition,
    'percent = greatest(coalesce(public.video_sessions.percent, 0), excluded.percent),',
    'percent = greatest(coalesce(public.video_sessions.percent, 0), coalesce(public.video_sessions.progress, 0), excluded.percent),'
  );

  v_definition := pg_catalog.replace(
    v_definition,
    'progress = greatest(coalesce(public.video_sessions.progress, 0), excluded.progress),',
    'progress = greatest(coalesce(public.video_sessions.progress, 0), coalesce(public.video_sessions.percent, 0), excluded.progress),'
  );

  execute v_definition;
end;
$sync$;
