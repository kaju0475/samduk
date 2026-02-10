
-- [Schema Repair] Add missing columns to 'cylinders' table (Safe Run)

-- 1. Date Fields
ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS charging_expiry_date DATE;

ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS manufacture_date DATE;

ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS last_inspection_date DATE;

-- 2. Technical Specs
-- ALTER TABLE public.cylinders 
-- ADD COLUMN IF NOT EXISTS work_pressure TEXT; -- [User Requested Removal]

-- 3. Soft Delete Support
ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 4. Capacity (Modern Standard)
-- If you want to migrate from Volume -> Capacity later
ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS capacity TEXT;
