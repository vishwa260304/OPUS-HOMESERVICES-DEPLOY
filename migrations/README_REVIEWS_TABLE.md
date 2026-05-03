# Reviews Table Migration

## Overview
This migration creates a comprehensive `reviews` table to store customer reviews for bookings, supporting both provider reviews and doctor reviews.

## Table Structure

### Key Features
- **Dual Review Types**: Supports both provider reviews (`provider_id`) and doctor reviews (`doctor_id`)
- **One Review Per Booking**: Each customer can only leave one review per booking (enforced by unique constraint)
- **Rating Validation**: Ratings must be between 1 and 5 stars
- **Flexible Review Target**: Either `provider_id` OR `doctor_id` can be set (or neither for general service reviews)

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `booking_id` | UUID | Foreign key to `bookings` table |
| `customer_user_id` | UUID | Foreign key to `auth.users` (the reviewer) |
| `provider_id` | UUID (nullable) | Foreign key to `providers_profiles` table (for provider reviews) |
| `doctor_id` | UUID (nullable) | Stores the `user_id` from `providers_doctor_details` table (for doctor reviews). References `auth.users(id)` |
| `rating` | INTEGER | Rating from 1 to 5 stars (required) |
| `review_text` | TEXT (nullable) | Optional text review/feedback |
| `review_date` | DATE | Date of the review (defaults to current date) |
| `service_name` | TEXT | Name of the service (for display) |
| `provider_name` | TEXT (nullable) | Name of the provider (for display) |
| `doctor_name` | TEXT (nullable) | Name of the doctor (for display) |
| `category` | TEXT (nullable) | Category of service (e.g., "Doctor Appointment", "Home Service") |
| `created_at` | TIMESTAMP | When the review was created |
| `updated_at` | TIMESTAMP | When the review was last updated |

### Constraints
- **Primary Key**: `id`
- **Foreign Keys**: 
  - `booking_id` → `bookings.id` (CASCADE delete)
  - `customer_user_id` → `auth.users.id` (CASCADE delete)
  - `provider_id` → `providers_profiles.id` (SET NULL on delete)
  - `doctor_id` → `auth.users.id` (SET NULL on delete). Stores the `user_id` from `providers_doctor_details`
- **Check Constraints**:
  - `rating` must be between 1 and 5
  - Either `provider_id` OR `doctor_id` should be set (or both can be NULL for general reviews)
- **Unique Constraint**: One review per booking per customer (`booking_id`, `customer_user_id`)

## Indexes
- `idx_reviews_booking_id`: Fast lookup by booking
- `idx_reviews_customer_user_id`: Fast lookup by customer
- `idx_reviews_provider_id`: Fast lookup by provider (partial index, only where provider_id IS NOT NULL)
- `idx_reviews_doctor_id`: Fast lookup by doctor (partial index, only where doctor_id IS NOT NULL)
- `idx_reviews_rating`: For rating-based queries
- `idx_reviews_created_at`: For sorting by date (DESC)

## Row Level Security (RLS) Policies

### Customer Policies
1. **View Own Reviews**: Customers can view their own reviews
2. **Insert Own Reviews**: Customers can create reviews (must set `customer_user_id = auth.uid()`)
3. **Update Own Reviews**: Customers can update their own reviews
4. **Delete Own Reviews**: Customers can delete their own reviews

### Provider Policies
5. **View Provider Reviews**: Providers can view reviews for their services (where `provider_id` matches their provider record)

### Doctor Policies
6. **View Doctor Reviews**: Doctors can view reviews for their services (where `doctor_id` matches their doctor record)

### Public Policies
7. **Public Read Access**: Unauthenticated users can view reviews (for public display on service pages)

## Usage Examples

### Creating a Provider Review
```sql
INSERT INTO public.reviews (
  booking_id,
  customer_user_id,
  provider_id,
  rating,
  review_text,
  service_name,
  provider_name,
  category
) VALUES (
  'booking-uuid-here',
  'customer-user-uuid-here',
  'provider-uuid-here',
  5,
  'Great service!',
  'Home Cleaning',
  'ABC Services',
  'Home Service'
);
```

### Creating a Doctor Review
```sql
INSERT INTO public.reviews (
  booking_id,
  customer_user_id,
  doctor_id,
  rating,
  review_text,
  service_name,
  doctor_name,
  category
) VALUES (
  'booking-uuid-here',
  'customer-user-uuid-here',
  'doctor-uuid-here',
  5,
  'Excellent consultation!',
  'Doctor Appointment',
  'Dr. John Doe',
  'Doctor Appointment'
);
```

### Querying Reviews

#### Get all reviews for a booking
```sql
SELECT * FROM public.reviews
WHERE booking_id = 'booking-uuid-here';
```

#### Get all reviews for a provider
```sql
SELECT * FROM public.reviews
WHERE provider_id = 'provider-uuid-here'
ORDER BY created_at DESC;
```

#### Get all reviews for a doctor
```sql
SELECT * FROM public.reviews
WHERE doctor_id = 'doctor-uuid-here'
ORDER BY created_at DESC;
```

#### Get average rating for a provider
```sql
SELECT 
  provider_id,
  AVG(rating) as average_rating,
  COUNT(*) as review_count
FROM public.reviews
WHERE provider_id = 'provider-uuid-here'
GROUP BY provider_id;
```

#### Get average rating for a doctor
```sql
SELECT 
  doctor_id,
  AVG(rating) as average_rating,
  COUNT(*) as review_count
FROM public.reviews
WHERE doctor_id = 'doctor-uuid-here'
GROUP BY doctor_id;
```

## Integration with Application Code

### For Doctor Appointments
When a customer reviews a doctor appointment:
1. Extract `doctor_id` from the booking's items (from `doctor_appointments` table via `booking_id`)
2. Extract `provider_id` from the doctor's record (if needed)
3. Set both `doctor_id` and `doctor_name` from the doctor details
4. Set `category` to `'Doctor Appointment'`

### For Provider Services
When a customer reviews a provider service:
1. Extract `provider_id` from the booking's items or booking record
2. Set `provider_id` and `provider_name` from the provider details
3. Set `category` to the appropriate service category

### Updating Reviews API
The existing `ReviewsApi` in `customer_app/lib/reviews.ts` should be updated to:
1. Accept `provider_id` and `doctor_id` parameters
2. Extract these IDs from booking data when creating reviews
3. Query reviews by `provider_id` or `doctor_id` for display purposes

## Migration Steps

1. **Run the SQL migration**:
   ```bash
   # Execute the SQL file in your Supabase SQL editor or via psql
   psql -h your-db-host -U your-user -d your-database -f create_reviews_table.sql
   ```

2. **Update application code** to use the new table structure:
   - Update `ReviewsApi` to include `provider_id` and `doctor_id`
   - Update review creation logic to extract provider/doctor IDs from bookings
   - Update review display logic to show provider/doctor-specific reviews

3. **Test the migration**:
   - Create a test review for a provider service
   - Create a test review for a doctor appointment
   - Verify RLS policies work correctly
   - Verify unique constraint prevents duplicate reviews

## Notes

- The table supports both provider and doctor reviews in a single structure
- The `provider_name` and `doctor_name` fields are denormalized for display purposes (to avoid joins)
- The `service_name` and `category` fields are also denormalized for easier querying
- Reviews are automatically timestamped with `created_at` and `updated_at`
- The unique constraint ensures one review per booking per customer, but customers can update their reviews

## Important Notes on Provider ID Type

**⚠️ Type Compatibility**: The `bookings` table may store `provider_id` as an `INTEGER` or `NUMBER`, while the `providers` table uses `UUID`. 

If your schema has this mismatch:
1. You may need to adjust the foreign key reference in `create_reviews_table.sql`
2. The helper functions in `helper_extract_review_targets.sql` include logic to handle this conversion
3. Alternatively, you can store `provider_id` as `TEXT` in the reviews table and convert as needed

**To check your schema**:
```sql
-- Check bookings.provider_id type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name = 'provider_id';

-- Check providers_profiles.id type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'providers_profiles' AND column_name = 'id';
```

**If types don't match**, you have two options:
1. **Option A**: Change `provider_id` in reviews table to match bookings (e.g., `INTEGER`)
2. **Option B**: Use a mapping table or function to convert between types when inserting reviews

