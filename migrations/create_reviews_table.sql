-- Create Reviews Table
-- This table stores customer reviews for bookings, supporting both provider and doctor reviews

-- Step 0: Drop existing constraints if they exist (for idempotent migrations)
DO $$
BEGIN
  -- Drop constraints if they exist
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_rating_check' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_rating_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_provider_or_doctor_check' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_provider_or_doctor_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_booking_customer_unique' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_booking_customer_unique;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_booking_id_fkey' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_booking_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_provider_id_fkey' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_provider_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_doctor_id_fkey' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_doctor_id_fkey;
  END IF;
END $$;

-- Step 1: Create the reviews table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Review target: Either provider_id OR doctor_id should be set (not both)
  provider_id UUID NULL,
  doctor_id UUID NULL,
  
  -- Review content
  rating INTEGER NOT NULL,
  review_text TEXT NULL,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Additional metadata for display purposes
  service_name TEXT NOT NULL,
  provider_name TEXT NULL,
  doctor_name TEXT NULL,
  category TEXT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Primary key constraint
  CONSTRAINT reviews_pkey PRIMARY KEY (id)
);

-- Step 1.1: Add foreign key constraints separately
DO $$
BEGIN
  -- Add foreign key for booking_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_booking_id_fkey' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
  END IF;
  
  -- Add foreign key for provider_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_provider_id_fkey' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_provider_id_fkey 
      FOREIGN KEY (provider_id) REFERENCES public.providers_profiles(id) ON DELETE SET NULL;
  END IF;
  
  -- Add foreign key for doctor_id if it doesn't exist
  -- doctor_id references user_id from providers_doctor_details, which is a foreign key to auth.users
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_doctor_id_fkey' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_doctor_id_fkey 
      FOREIGN KEY (doctor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  -- Add check constraint for rating if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_rating_check' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_check 
      CHECK (rating >= 1 AND rating <= 5);
  END IF;
  
  -- Add check constraint for provider_or_doctor if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_provider_or_doctor_check' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_provider_or_doctor_check 
      CHECK (
        (provider_id IS NOT NULL AND doctor_id IS NULL) OR 
        (provider_id IS NULL AND doctor_id IS NOT NULL) OR
        (provider_id IS NULL AND doctor_id IS NULL)
      );
  END IF;
  
  -- Add unique constraint if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_booking_customer_unique' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_booking_customer_unique 
      UNIQUE (booking_id, customer_user_id);
  END IF;
END $$;

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON public.reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_user_id ON public.reviews(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_id ON public.reviews(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_doctor_id ON public.reviews(doctor_id) WHERE doctor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- Step 3: Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_reviews_updated_at ON public.reviews;
CREATE TRIGGER trigger_update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing RLS policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Customers can view their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Customers can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Customers can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Customers can delete their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Providers can view their provider reviews" ON public.reviews;
DROP POLICY IF EXISTS "Doctors can view their doctor reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;

-- Step 6.1: Create RLS Policies

-- Policy 1: Customers can view their own reviews
CREATE POLICY "Customers can view their own reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (auth.uid() = customer_user_id);

-- Policy 2: Customers can insert their own reviews
CREATE POLICY "Customers can insert their own reviews"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_user_id);

-- Policy 3: Customers can update their own reviews
CREATE POLICY "Customers can update their own reviews"
ON public.reviews FOR UPDATE
TO authenticated
USING (auth.uid() = customer_user_id)
WITH CHECK (auth.uid() = customer_user_id);

-- Policy 4: Customers can delete their own reviews
CREATE POLICY "Customers can delete their own reviews"
ON public.reviews FOR DELETE
TO authenticated
USING (auth.uid() = customer_user_id);

-- Policy 5: Providers can view reviews for their services (provider reviews)
CREATE POLICY "Providers can view their provider reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.providers_profiles
    WHERE providers_profiles.id = reviews.provider_id
    AND providers_profiles.user_id = auth.uid()
  )
);

-- Policy 6: Doctors can view reviews for their services (doctor reviews)
-- doctor_id stores the user_id from providers_doctor_details
CREATE POLICY "Doctors can view their doctor reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (
  reviews.doctor_id = auth.uid()
);

-- Policy 7: Public read access for reviews (for displaying ratings on service pages)
-- This allows unauthenticated users to view reviews for public display
CREATE POLICY "Public can view reviews"
ON public.reviews FOR SELECT
TO anon
USING (true);

-- Step 7: Add comments for documentation
COMMENT ON TABLE public.reviews IS 'Stores customer reviews for bookings, supporting both provider and doctor reviews';
COMMENT ON COLUMN public.reviews.booking_id IS 'Foreign key to the booking this review is for';
COMMENT ON COLUMN public.reviews.customer_user_id IS 'The customer who wrote the review';
COMMENT ON COLUMN public.reviews.provider_id IS 'The provider being reviewed (for provider reviews)';
COMMENT ON COLUMN public.reviews.doctor_id IS 'The doctor user_id being reviewed (for doctor reviews). References user_id from providers_doctor_details table, which is a foreign key to auth.users(id)';
COMMENT ON COLUMN public.reviews.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN public.reviews.review_text IS 'Optional text review/feedback';
COMMENT ON COLUMN public.reviews.service_name IS 'Name of the service for display purposes';
COMMENT ON COLUMN public.reviews.provider_name IS 'Name of the provider for display purposes';
COMMENT ON COLUMN public.reviews.doctor_name IS 'Name of the doctor for display purposes';
COMMENT ON COLUMN public.reviews.category IS 'Category of the service (e.g., "Doctor Appointment", "Home Service")';

