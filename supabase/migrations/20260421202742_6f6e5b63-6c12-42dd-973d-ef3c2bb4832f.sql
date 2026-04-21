-- Restrict listing: only allow reading specific files, not enumerating bucket
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

CREATE POLICY "Avatar files publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);
