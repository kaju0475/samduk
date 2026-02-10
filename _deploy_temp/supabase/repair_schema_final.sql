
-- [Final Comprehensive Schema Fix]
-- Based on "100-Case" Deep Audit of Application Logic

-- 1. Structural Identity (Critical for "Generation Failed" Fix)
-- Used to distinguish Single Cylinders vs Racks
ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS container_type TEXT DEFAULT 'CYLINDER';

-- Used for Bundle/Rack parent-child relationships
ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS parent_rack_id UUID;

-- 2. Logic Integrity (Required for "Duplicate Check")
-- Code explicitly checks .eq('is_deleted', false), so this MUST exist.
ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.cylinders 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
