-- Persistent manual ordering for educational videos.
alter table public.videos
  add column if not exists sort_order integer;

-- Existing rows keep the order that was previously used by the student page.
with ranked as (
  select id, row_number() over (order by id asc)::integer as rn
  from public.videos
  where sort_order is null
)
update public.videos v
set sort_order = ranked.rn
from ranked
where v.id = ranked.id;

create or replace function public.set_video_upload_defaults()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.created_at is null then
    new.created_at := pg_catalog.now();
  end if;

  if new.sort_order is null then
    select coalesce(min(v.sort_order), 1) - 1
      into new.sort_order
    from public.videos v;
  end if;

  return new;
end;
$function$;

drop trigger if exists videos_set_upload_defaults on public.videos;
create trigger videos_set_upload_defaults
before insert on public.videos
for each row execute function public.set_video_upload_defaults();

create or replace function public.admin_reorder_video(
  p_video_id uuid,
  p_direction integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_order integer;
  v_neighbor_id uuid;
  v_neighbor_order integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise insufficient_privilege using message = 'Admin access required';
  end if;

  if p_direction not in (-1, 1) then
    raise invalid_parameter_value using message = 'Direction must be -1 or 1';
  end if;

  select v.sort_order
    into v_current_order
  from public.videos v
  where v.id = p_video_id;

  if not found then
    return pg_catalog.jsonb_build_object('success', false, 'reason', 'video_not_found');
  end if;

  if p_direction = -1 then
    select v.id, v.sort_order
      into v_neighbor_id, v_neighbor_order
    from public.videos v
    where v.sort_order < v_current_order
    order by v.sort_order desc, v.created_at desc nulls last, v.id
    limit 1;
  else
    select v.id, v.sort_order
      into v_neighbor_id, v_neighbor_order
    from public.videos v
    where v.sort_order > v_current_order
    order by v.sort_order asc, v.created_at desc nulls last, v.id
    limit 1;
  end if;

  if v_neighbor_id is null then
    return pg_catalog.jsonb_build_object('success', true, 'moved', false);
  end if;

  update public.videos set sort_order = v_neighbor_order where id = p_video_id;
  update public.videos set sort_order = v_current_order where id = v_neighbor_id;

  return pg_catalog.jsonb_build_object('success', true, 'moved', true);
end;
$function$;

revoke all on function public.admin_reorder_video(uuid, integer) from public;
revoke all on function public.admin_reorder_video(uuid, integer) from anon;
grant execute on function public.admin_reorder_video(uuid, integer) to authenticated;
