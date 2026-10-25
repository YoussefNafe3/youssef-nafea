-- Add a secure admin-only RPC for editing video titles from the video manager.
create or replace function public.admin_rename_video(
  p_video_id uuid,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_title text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise insufficient_privilege using message = 'Admin access required';
  end if;

  v_title := pg_catalog.btrim(coalesce(p_title, ''));
  if v_title = '' then
    raise invalid_parameter_value using message = 'Video title cannot be empty';
  end if;
  if pg_catalog.char_length(v_title) > 180 then
    raise string_data_right_truncation using message = 'Video title is too long';
  end if;

  update public.videos
  set title = v_title
  where id = p_video_id;

  if not found then
    return pg_catalog.jsonb_build_object('success', false, 'reason', 'video_not_found');
  end if;

  return pg_catalog.jsonb_build_object('success', true, 'title', v_title);
end;
$function$;

revoke all on function public.admin_rename_video(uuid, text) from public;
revoke all on function public.admin_rename_video(uuid, text) from anon;
grant execute on function public.admin_rename_video(uuid, text) to authenticated;
