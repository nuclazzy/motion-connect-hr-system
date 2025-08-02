# Supabase Schema Update Instructions

## Required Schema Changes

### 1. Add Missing Columns to leave_days Table

Please execute the following SQL commands in your Supabase SQL Editor:

```sql
-- Add substitute_leave_hours column
ALTER TABLE public.leave_days 
ADD COLUMN substitute_leave_hours NUMERIC DEFAULT 0;

-- Add compensatory_leave_hours column  
ALTER TABLE public.leave_days 
ADD COLUMN compensatory_leave_hours NUMERIC DEFAULT 0;

-- Update existing records to have default values (0 hours)
UPDATE public.leave_days 
SET substitute_leave_hours = 0 
WHERE substitute_leave_hours IS NULL;

UPDATE public.leave_days 
SET compensatory_leave_hours = 0 
WHERE compensatory_leave_hours IS NULL;

-- Verify the changes
SELECT 
  user_id,
  substitute_leave_hours,
  compensatory_leave_hours,
  leave_types
FROM public.leave_days
LIMIT 5;
```

### 2. Column Descriptions

- **substitute_leave_hours**: Stores the number of substitute leave hours available for the employee (토요일 근무에 대한 대체휴가)
- **compensatory_leave_hours**: Stores the number of compensatory leave hours available for the employee (일요일/공휴일 근무에 대한 보상휴가)

### 3. Expected Result

After executing these commands, the leave_days table should have:
- All existing columns (id, user_id, leave_types, created_at, updated_at)
- New substitute_leave_hours column (numeric, default 0)
- New compensatory_leave_hours column (numeric, default 0)

### 4. Next Steps

Once you've added these columns in Supabase, the system will automatically:
- Allow admins to grant hourly substitute/compensatory leave
- Display correct remaining hours in leave applications
- Apply proper usage rules (1-day minimum for substitute, 0.5-day minimum for compensatory)

## Form Templates Integration Status

✅ **Form templates are properly integrated with Supabase**
- form_templates table exists with proper structure
- Templates are loaded from database
- Form submissions are stored in form_requests table
- All form data is properly persisted to Supabase

The system is ready for full deployment once the schema fields are added.