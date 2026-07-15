-- Migration: Add missing profile columns to match app expectations
-- This adds all the columns that the app code expects but are currently missing

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS avatar_id text,
ADD COLUMN IF NOT EXISTS avatar_metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deletion_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS security_level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS require_2fa boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS password_changed_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_email boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_phone boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT jsonb_build_object('notify_likes', false, 'notify_comments', false, 'notify_shares', false),
ADD COLUMN IF NOT EXISTS pro_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active'::text,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'::text,
ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_payment_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS invite_code_used text,
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
ADD COLUMN IF NOT EXISTS paystack_customer_id text UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free'::text,
ADD COLUMN IF NOT EXISTS subscription_expires timestamp with time zone,
ADD COLUMN IF NOT EXISTS engagement_points numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS home_address text,
ADD COLUMN IF NOT EXISTS boost_selections jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS reward_level text DEFAULT 'none'::text,
ADD COLUMN IF NOT EXISTS reward_level_since timestamp with time zone,
ADD COLUMN IF NOT EXISTS level_activity_score numeric DEFAULT 0;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Create index on deleted_at for soft delete queries
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);
