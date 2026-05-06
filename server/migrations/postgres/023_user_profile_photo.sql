ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_photo_data_url TEXT NULL;
