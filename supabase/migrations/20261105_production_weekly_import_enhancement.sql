-- ============================================================================
-- Smart Hisab (স্মার্ট হিসাব) — Database Migration
-- Migration: 20261105_production_weekly_import_enhancement.sql
-- Purpose:
--   1. Preserve all existing data and tables.
--   2. Add enhanced Production Module fields (item_name, category, sizes, colors,
--      work_status, settlement_status, start_work_time, end_work_time,
--      work_duration_minutes, received_wage, pending_wage, import_batch_id).
--   3. Create supporting tables if not exists.
--   4. Maintain strict Row Level Security (RLS) so each operator only accesses
--      their own records (auth.uid() = user_id).
--   5. Add composite indexes for fast Saturday-to-Thursday weekly reporting.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Production Entries Table (প্রোডাকশন হিসাব)
CREATE TABLE IF NOT EXISTS public.production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  item_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  garment_type text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  sizes text[] NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT '',
  colors text[] NOT NULL DEFAULT '{}',
  pieces integer NOT NULL DEFAULT 0,
  dozens numeric(12, 4) NOT NULL DEFAULT 0,
  rate_per_dozen numeric(12, 2) NOT NULL DEFAULT 0,
  total_wage numeric(12, 2) NOT NULL DEFAULT 0,
  received_wage numeric(12, 2) NOT NULL DEFAULT 0,
  pending_wage numeric(12, 2) NOT NULL DEFAULT 0,
  work_status text NOT NULL DEFAULT 'in_progress' CHECK (work_status IN ('in_progress', 'completed')),
  settlement_status text NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled')),
  start_work_time timestamptz NULL,
  end_work_time timestamptz NULL,
  work_duration_minutes integer NULL,
  short_description text NOT NULL DEFAULT '',
  photo_urls text[] NOT NULL DEFAULT '{}',
  import_batch_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Non-destructive column additions if table already existed from Phase 1
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS item_name text NOT NULL DEFAULT '';
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS sizes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS colors text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS received_wage numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS pending_wage numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS work_status text NOT NULL DEFAULT 'in_progress';
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS start_work_time timestamptz NULL;
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS end_work_time timestamptz NULL;
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS work_duration_minutes integer NULL;
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS import_batch_id text NULL;
ALTER TABLE public.production_entries ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Indexes for fast chronological and Saturday-to-Thursday weekly queries
CREATE INDEX IF NOT EXISTS idx_production_entries_user_date
  ON public.production_entries (user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_production_entries_user_status
  ON public.production_entries (user_id, work_status, settlement_status);

CREATE INDEX IF NOT EXISTS idx_production_entries_import_batch
  ON public.production_entries (user_id, import_batch_id);

-- 2. Wage Periods Table (মজুরি ও পাওনা)
CREATE TABLE IF NOT EXISTS public.wage_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  line_number text NOT NULL DEFAULT '',
  total_dozens numeric(12, 4) NOT NULL DEFAULT 0,
  total_pieces integer NOT NULL DEFAULT 0,
  earned_wage numeric(12, 2) NOT NULL DEFAULT 0,
  paid_wage numeric(12, 2) NOT NULL DEFAULT 0,
  outstanding_wage numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'আংশিক বকেয়া',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Payment Withdrawals Table (টাকা উত্তোলন)
CREATE TABLE IF NOT EXISTS public.payment_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  withdrawal_date date NOT NULL DEFAULT CURRENT_DATE,
  voucher_no text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT '',
  week_reference text NOT NULL DEFAULT '',
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  approved_by text NOT NULL DEFAULT '',
  remarks text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Loan Records Table (ঋণের হিসাব)
CREATE TABLE IF NOT EXISTS public.loan_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_direction text NOT NULL CHECK (loan_direction IN ('receivable', 'payable')),
  counterparty_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  principal_amount numeric(12, 2) NOT NULL DEFAULT 0,
  settled_amount numeric(12, 2) NOT NULL DEFAULT 0,
  remaining_balance numeric(12, 2) NOT NULL DEFAULT 0,
  status_label text NOT NULL DEFAULT 'চলমান',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Fund Accounts Table (ফান্ড ম্যানেজমেন্ট)
CREATE TABLE IF NOT EXISTS public.fund_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  fund_name text NOT NULL,
  fund_type text NOT NULL,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  monthly_contribution numeric(12, 2) NOT NULL DEFAULT 0,
  target_amount numeric(12, 2) NOT NULL DEFAULT 0,
  current_balance numeric(12, 2) NOT NULL DEFAULT 0,
  institution_or_method text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Personal Income & Expense Transactions Table (আয়-ব্যয়)
CREATE TABLE IF NOT EXISTS public.income_expense_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  category text NOT NULL,
  payment_method text NOT NULL DEFAULT '',
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wage_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_expense_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for production_entries
DROP POLICY IF EXISTS "Users can view own production entries" ON public.production_entries;
CREATE POLICY "Users can view own production entries"
  ON public.production_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own production entries" ON public.production_entries;
CREATE POLICY "Users can insert own production entries"
  ON public.production_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own production entries" ON public.production_entries;
CREATE POLICY "Users can update own production entries"
  ON public.production_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own production entries" ON public.production_entries;
CREATE POLICY "Users can delete own production entries"
  ON public.production_entries FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for supporting tables
DROP POLICY IF EXISTS "Users manage own wage_periods" ON public.wage_periods;
CREATE POLICY "Users manage own wage_periods"
  ON public.wage_periods FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own payment_withdrawals" ON public.payment_withdrawals;
CREATE POLICY "Users manage own payment_withdrawals"
  ON public.payment_withdrawals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own loan_records" ON public.loan_records;
CREATE POLICY "Users manage own loan_records"
  ON public.loan_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own fund_accounts" ON public.fund_accounts;
CREATE POLICY "Users manage own fund_accounts"
  ON public.fund_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own income_expense_transactions" ON public.income_expense_transactions;
CREATE POLICY "Users manage own income_expense_transactions"
  ON public.income_expense_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
