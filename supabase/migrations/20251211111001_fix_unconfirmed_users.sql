/*
  # Fix Unconfirmed Users
  
  This migration confirms all existing users so they can log in without
  email verification.
  
  Changes:
  - Confirms all unconfirmed users
  - Creates missing profile records
*/

-- Update existing users to be confirmed
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- Ensure all users have profiles
INSERT INTO public.profiles (id, email, plan)
SELECT u.id, u.email, 'free'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
