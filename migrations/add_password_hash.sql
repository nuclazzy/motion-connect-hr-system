-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Set default password "0000" for all existing users
UPDATE users 
SET password_hash = '$2a$10$rXKqLf8L8/5WJ8j/4tLJR.NLXqpOGKIpJQOmX8qpJfGUKjYQFEUUa' 
WHERE password_hash IS NULL;