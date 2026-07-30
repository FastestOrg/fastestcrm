-- Migration: Fix pgcrypto search path for BYOS encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Update byos_encrypt_key to search public, extensions
CREATE OR REPLACE FUNCTION public.byos_encrypt_key(plain_key TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  passphrase TEXT;
BEGIN
  passphrase := COALESCE(current_setting('app.settings.byos_encryption_key', true), 'byos-default-key-change-in-production');
  RETURN extensions.pgp_sym_encrypt(plain_key, passphrase);
END;
$$;

-- Update byos_decrypt_key to search public, extensions
CREATE OR REPLACE FUNCTION public.byos_decrypt_key(encrypted_key BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  passphrase TEXT;
BEGIN
  passphrase := COALESCE(current_setting('app.settings.byos_encryption_key', true), 'byos-default-key-change-in-production');
  RETURN extensions.pgp_sym_decrypt(encrypted_key, passphrase);
END;
$$;
