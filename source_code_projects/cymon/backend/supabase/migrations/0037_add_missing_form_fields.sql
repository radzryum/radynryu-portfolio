ALTER TABLE patients ADD COLUMN IF NOT EXISTS delivery_method text not null default 'email';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS force_password_change boolean not null default true;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS previously_diagnosed boolean;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS other_disability boolean;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS parent_signature text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS rep_signature text;
