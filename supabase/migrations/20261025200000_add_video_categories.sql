-- Add a teacher-managed category for student video submenus.
alter table public.videos
  add column if not exists video_category text not null default 'explanation';

-- Existing videos remain in the main explanation library until the teacher classifies them.
update public.videos
set video_category = 'explanation'
where video_category is null
   or video_category not in ('explanation', 'homework');

alter table public.videos
  alter column video_category set default 'explanation';

alter table public.videos
  drop constraint if exists videos_video_category_check;

alter table public.videos
  add constraint videos_video_category_check
  check (video_category in ('explanation', 'homework'));


-- Category changes are exposed only through an admin-validated RPC because
-- the videos table intentionally has no broad UPDATE policy.
create or replace function public.admin_set_video_category(
  p_video_id uuid,
  p_category text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin() then
    raise insufficient_privilege using message = 'Admin access required';
  end if;

  if p_category not in ('explanation', 'homework') then
    raise invalid_parameter_value using message = 'Invalid video category';
  end if;

  update public.videos
  set video_category = p_category
  where id = p_video_id;

  if not found then
    return pg_catalog.jsonb_build_object('success', false, 'reason', 'video_not_found');
  end if;

  return pg_catalog.jsonb_build_object('success', true, 'video_category', p_category);
end;
$function$;

revoke all on function public.admin_set_video_category(uuid, text) from public;
revoke all on function public.admin_set_video_category(uuid, text) from anon;
grant execute on function public.admin_set_video_category(uuid, text) to authenticated;
