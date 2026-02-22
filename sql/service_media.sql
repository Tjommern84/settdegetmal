-- Add media metadata to services.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS logo_image_url text;

-- Create a public storage bucket for service media.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'service-media') THEN
    PERFORM storage.create_bucket('service-media', TRUE);
  END IF;
END
$$;

-- Only the owner of a service can insert/update/delete media objects for that service.
CREATE POLICY IF NOT EXISTS service_media_owner_policy
  ON storage.objects
  FOR INSERT, UPDATE, DELETE
  WITH CHECK (
    request.auth.uid() IS NOT NULL
    AND bucket_id = 'service-media'
    AND name LIKE 'service/%/%'
    AND EXISTS (
      SELECT 1
      FROM services
      WHERE id = split_part(name, '/', 2)
        AND owner_user_id = request.auth.uid()
    )
  )
  USING (
    request.auth.uid() IS NOT NULL
    AND bucket_id = 'service-media'
    AND name LIKE 'service/%/%'
    AND EXISTS (
      SELECT 1
      FROM services
      WHERE id = split_part(name, '/', 2)
        AND owner_user_id = request.auth.uid()
    )
  );
