
-- Create settings table for Global System Configuration
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.settings enable row level security;

-- Policy: Allow Read for Everyone (Needed for Login page etc)
create policy "Allow Public Read" on public.settings for select using (true);

-- Policy: Allow Insert/Update for Authenticated Users (Admins)
create policy "Allow Admin Write" on public.settings for all using (auth.role() = 'authenticated');

-- Insert Default Company Info
insert into public.settings (key, value)
values (
  'company', 
  '{ "companyName": "삼덕가스공업(주)", "aliases": ["삼덕", "SDG", "삼덕가스"] }'::jsonb
)
on conflict (key) do nothing;
