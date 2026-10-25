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
