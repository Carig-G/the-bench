-- Add contact info field for users to share when revealed
ALTER TABLE users ADD COLUMN contact_info TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;

-- DOWN

ALTER TABLE users DROP COLUMN IF EXISTS contact_info;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
