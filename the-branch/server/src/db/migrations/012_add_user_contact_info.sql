-- Add contact info field for users to share when revealed
ALTER TABLE users ADD COLUMN contact_info TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;

-- DOWN

-- SQLite doesn't support DROP COLUMN easily, would need to recreate table
