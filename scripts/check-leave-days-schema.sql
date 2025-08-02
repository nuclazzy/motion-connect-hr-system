-- Check current leave_days table schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'leave_days' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
ALTER TABLE public.leave_days 
ADD COLUMN IF NOT EXISTS substitute_leave_hours numeric DEFAULT 0;

ALTER TABLE public.leave_days 
ADD COLUMN IF NOT EXISTS compensatory_leave_hours numeric DEFAULT 0;

-- Update existing records to have default values for new columns
UPDATE public.leave_days 
SET substitute_leave_hours = 0 
WHERE substitute_leave_hours IS NULL;

UPDATE public.leave_days 
SET compensatory_leave_hours = 0 
WHERE compensatory_leave_hours IS NULL;

-- Check the updated schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'leave_days' 
AND table_schema = 'public'
ORDER BY ordinal_position;