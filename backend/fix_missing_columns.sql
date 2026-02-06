-- Fix missing columns in organizations table
-- Run this against your Supabase database to add columns that the model expects
-- All statements use IF NOT EXISTS / safe checks so they can be run multiple times

-- From migration e5f6a7b8c9d0: org tax rates
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cnpj_tax_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS produtora_tax_rate NUMERIC(5,2) DEFAULT 0;

-- From migration a1b2c3d4e5f6: Stripe Connect fields
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_connect_enabled_at TIMESTAMPTZ;

-- From migration f8a1b2c3d4e5: default bank account
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_bank_account_id UUID REFERENCES bank_accounts(id);

-- From migration b1f3c9a4e6d2: billing fields (in case they're also missing)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_status VARCHAR;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_contact_user_id UUID REFERENCES profiles(id);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_profile_id UUID REFERENCES profiles(id);

-- Stripe Connect fields for invoices (from a1b2c3d4e5f6)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link_url VARCHAR;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link_expires_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_via VARCHAR;

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'organizations' ORDER BY ordinal_position;
