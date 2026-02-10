-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Tables
create table if not exists users (
  id text primary key,
  username text unique not null,
  name text not null,
  role text not null check (role in ('관리자', '사용자')),
  password text not null,
  created_at timestamptz default now()
);

create table if not exists customers (
  id text primary key,
  name text not null,
  phone text,
  address text,
  manager text, -- representative
  tanks jsonb,
  "lastTransactionDate" text,
  balance integer default 0,
  -- [Added Fields]
  type text default 'BUSINESS',
  payment_type text default 'card', -- card, cash, tax
  business_number text,
  ledger_number text,
  corporate_id text,
  fax text,
  created_at timestamptz default now()
);

create table if not exists cylinders (
  id text primary key, -- Serial Number (Bar Code)
  gas_type text not null, -- Gas Type ID (e.g., O2-40L)
  ownership text not null check (ownership in ('SAMDUK', 'CUSTOMER')), -- Owner Type
  owner_id text references customers(id), -- If owned by Customer (Legacy?) -> mapped to 'ownership' string in code often
  location text not null, -- Current Location (Customer ID or 'SAMDUK')
  status text not null,
  "lastTransactionDate" text,
  "returnDate" text,
  memo text,
  -- [Added Fields]
  charging_expiry_date text,
  manufacture_date text,
  last_inspection_date text,
  parent_rack_id text, 
  volume text, -- Capacity (e.g. 40L)
  created_at timestamptz default now()
);

create table if not exists transactions (
  id text primary key,
  type text not null,
  date text not null,
  "customerName" text, -- Denormalized for easy viewing
  "gasType" text,
  quantity integer,
  "workerId" text,
  "customerId" text,
  "cylinderId" text,
  status text,
  is_manual boolean default false,
  created_at timestamptz default now()
);

create table if not exists gas_items (
  id text primary key,
  name text not null,
  capacity text,
  color text
);

-- 3. Enable Public Access (Since we use local app logic for auth currently)
alter table users enable row level security;
alter table customers enable row level security;
alter table cylinders enable row level security;
alter table transactions enable row level security;
alter table gas_items enable row level security;

-- Allow ALL access for now (Development/Migration Phase)
-- We will lock this down later if needed.
create policy "Allow All Access" on users for all using (true) with check (true);
create policy "Allow All Access" on customers for all using (true) with check (true);
create policy "Allow All Access" on cylinders for all using (true) with check (true);
create policy "Allow All Access" on transactions for all using (true) with check (true);
create policy "Allow All Access" on gas_items for all using (true) with check (true);
