-- Helper Functions to Extract Provider/Doctor IDs from Bookings
-- These functions help populate provider_id and doctor_id when creating reviews

-- Function 1: Get provider_id from booking
-- This function extracts the provider_id from a booking record
CREATE OR REPLACE FUNCTION get_provider_id_from_booking(booking_uuid UUID)
RETURNS UUID AS $$
DECLARE
  provider_id_result UUID;
  provider_id_number INTEGER;
BEGIN
  -- First, try to get provider_id from bookings table (if it's stored as UUID)
  SELECT b.provider_id::UUID INTO provider_id_result
  FROM public.bookings b
  WHERE b.id = booking_uuid
  AND b.provider_id IS NOT NULL;
  
  -- If found, return it
  IF provider_id_result IS NOT NULL THEN
    RETURN provider_id_result;
  END IF;
  
  -- If provider_id is stored as INTEGER, try to convert via provider_service_mapping
  SELECT b.provider_id INTO provider_id_number
  FROM public.bookings b
  WHERE b.id = booking_uuid
  AND b.provider_id IS NOT NULL;
  
  -- Try to find UUID from providers_profiles table using the integer ID
  -- Note: This assumes there's a mapping. Adjust based on your schema.
  IF provider_id_number IS NOT NULL THEN
    SELECT pp.id INTO provider_id_result
    FROM public.providers_profiles pp
    WHERE pp.id::TEXT LIKE '%' || provider_id_number::TEXT || '%'
    LIMIT 1;
  END IF;
  
  RETURN provider_id_result;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Get doctor_id from booking
-- This function extracts the doctor user_id from a booking via doctor_appointments table
-- Returns the user_id from providers_doctor_details (which is stored in doctor_id column)
CREATE OR REPLACE FUNCTION get_doctor_id_from_booking(booking_uuid UUID)
RETURNS UUID AS $$
DECLARE
  doctor_id_result UUID;
BEGIN
  -- Get doctor_user_id directly from doctor_appointments table
  -- This user_id is what we store in the reviews.doctor_id column
  SELECT da.doctor_user_id INTO doctor_id_result
  FROM public.doctor_appointments da
  WHERE da.booking_id = booking_uuid
  LIMIT 1;
  
  RETURN doctor_id_result;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Get doctor name from booking
CREATE OR REPLACE FUNCTION get_doctor_name_from_booking(booking_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  doctor_name_result TEXT;
  doctor_user_id_result UUID;
BEGIN
  -- Get doctor_user_id from doctor_appointments table
  SELECT da.doctor_user_id INTO doctor_user_id_result
  FROM public.doctor_appointments da
  WHERE da.booking_id = booking_uuid
  LIMIT 1;
  
  -- If found, get the doctor name from providers_doctor_details using user_id
  IF doctor_user_id_result IS NOT NULL THEN
    SELECT pdd.doctor_name INTO doctor_name_result
    FROM public.providers_doctor_details pdd
    WHERE pdd.user_id = doctor_user_id_result
    LIMIT 1;
  END IF;
  
  RETURN doctor_name_result;
END;
$$ LANGUAGE plpgsql;

-- Function 4: Helper function to create a review with automatic provider/doctor detection
-- This function automatically detects whether it's a provider or doctor review
CREATE OR REPLACE FUNCTION create_review_with_auto_detect(
  p_booking_id UUID,
  p_customer_user_id UUID,
  p_rating INTEGER,
  p_service_name TEXT,
  p_review_text TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_provider_id UUID;
  v_doctor_id UUID;
  v_provider_name TEXT;
  v_doctor_name TEXT;
  v_review_id UUID;
  v_booking_provider_id INTEGER;
BEGIN
  -- Get provider_id from booking
  v_provider_id := get_provider_id_from_booking(p_booking_id);
  
  -- Get doctor_id from booking
  v_doctor_id := get_doctor_id_from_booking(p_booking_id);
  
  -- Get doctor name if doctor_id exists
  IF v_doctor_id IS NOT NULL THEN
    v_doctor_name := get_doctor_name_from_booking(p_booking_id);
  END IF;
  
  -- Get provider name from bookings table if provider_id exists
  IF v_provider_id IS NOT NULL THEN
    SELECT b.provider_name INTO v_provider_name
    FROM public.bookings b
    WHERE b.id = p_booking_id;
  END IF;
  
  -- Insert the review
  INSERT INTO public.reviews (
    booking_id,
    customer_user_id,
    provider_id,
    doctor_id,
    rating,
    review_text,
    service_name,
    provider_name,
    doctor_name,
    category,
    review_date
  ) VALUES (
    p_booking_id,
    p_customer_user_id,
    v_provider_id,
    v_doctor_id,
    p_rating,
    p_review_text,
    p_service_name,
    v_provider_name,
    v_doctor_name,
    p_category,
    CURRENT_DATE
  )
  ON CONFLICT (booking_id, customer_user_id)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    review_text = EXCLUDED.review_text,
    provider_id = EXCLUDED.provider_id,
    doctor_id = EXCLUDED.doctor_id,
    provider_name = EXCLUDED.provider_name,
    doctor_name = EXCLUDED.doctor_name,
    updated_at = NOW()
  RETURNING id INTO v_review_id;
  
  RETURN v_review_id;
END;
$$ LANGUAGE plpgsql;

-- Example usage of the helper function:
-- SELECT create_review_with_auto_detect(
--   'booking-uuid-here'::UUID,
--   'customer-user-uuid-here'::UUID,
--   5,
--   'Doctor Appointment',  -- service_name (required)
--   'Great service!',       -- review_text (optional, can be NULL)
--   'Doctor Appointment'    -- category (optional, can be NULL)
-- );

-- Add comments
COMMENT ON FUNCTION get_provider_id_from_booking(UUID) IS 'Extracts provider_id from a booking record';
COMMENT ON FUNCTION get_doctor_id_from_booking(UUID) IS 'Extracts doctor user_id from a booking via doctor_appointments table. Returns the user_id which is stored in reviews.doctor_id column';
COMMENT ON FUNCTION get_doctor_name_from_booking(UUID) IS 'Extracts doctor name from a booking';
COMMENT ON FUNCTION create_review_with_auto_detect(UUID, UUID, INTEGER, TEXT, TEXT, TEXT) IS 'Creates a review and automatically detects provider_id or doctor_id from the booking';

