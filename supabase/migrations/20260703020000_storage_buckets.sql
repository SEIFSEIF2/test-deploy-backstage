-- Storage buckets are not part of schema dumps, so fresh one-click deploys
-- were missing them ("Bucket not found" during onboarding). All access goes
-- through the service-role client, so no storage.objects policies needed.
-- Idempotent for installs where the buckets were created by hand.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('task-attachments', 'task-attachments', false, null, null)
on conflict (id) do nothing;
