-- MCQ Campus production OTP schema update
-- Safe additive change for the existing core_onetimetoken table.
-- Run once in Supabase SQL Editor BEFORE deploying OTP-enabled application code.

BEGIN;

ALTER TABLE core_onetimetoken
    ADD COLUMN IF NOT EXISTS attempt_count smallint NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'core_onetimetoken_attempt_count_nonnegative'
    ) THEN
        ALTER TABLE core_onetimetoken
            ADD CONSTRAINT core_onetimetoken_attempt_count_nonnegative
            CHECK (attempt_count >= 0);
    END IF;
END
$$;

COMMIT;

-- No token_hash rename is required.
-- Django's code_hash model field intentionally maps to the existing token_hash column
-- via db_column='token_hash', preserving current production data.
