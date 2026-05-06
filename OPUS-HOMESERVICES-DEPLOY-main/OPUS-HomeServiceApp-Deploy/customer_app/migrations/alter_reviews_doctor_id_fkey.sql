-- Alter reviews table to change doctor_id foreign key
-- doctor_id now stores user_id from providers_doctor_details, so it should reference auth.users(id)

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS reviews_doctor_id_fkey;

-- Step 2: Add the new foreign key constraint referencing auth.users(id)
ALTER TABLE public.reviews 
ADD CONSTRAINT reviews_doctor_id_fkey 
FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 3: Update the comment
COMMENT ON COLUMN public.reviews.doctor_id IS 'The doctor user_id being reviewed (for doctor reviews). References user_id from providers_doctor_details table, which is a foreign key to auth.users(id)';

