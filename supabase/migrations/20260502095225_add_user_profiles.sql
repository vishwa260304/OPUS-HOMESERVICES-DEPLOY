create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  created_at timestamp default now()
);