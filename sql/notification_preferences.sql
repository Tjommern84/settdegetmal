ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_booking_confirmed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_booking_cancelled boolean NOT NULL DEFAULT true;
