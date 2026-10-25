# Video progress tracking fix

Working branch: fix/video-progress-tracking

Root causes confirmed:
- videos.html writes `progress` but analytics reads `percent`.
- video_sessions has no `last_time` column.
- Analytics selected highest historical percent rather than newest record.
- Existing rows have null percent; 241 of 254 rows cannot use the percent column.

Changes should be staged on this branch first. Production schema and published files remain unchanged until the RPC migration and branch changes are verified.

Implementation is in progress; production branch has not been changed.
