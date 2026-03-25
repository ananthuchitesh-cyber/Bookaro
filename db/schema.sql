CREATE TABLE IF NOT EXISTS destinations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tourist_places (
  id SERIAL PRIMARY KEY,
  destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  district TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tourist_attraction',
  description TEXT,
  address TEXT NOT NULL,
  rating NUMERIC(2,1),
  review_count INTEGER,
  entry_fee INTEGER,
  best_time TEXT,
  must_visit BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  map_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_state ON destinations(lower(state));
CREATE INDEX IF NOT EXISTS idx_places_destination ON tourist_places(destination_id);
CREATE INDEX IF NOT EXISTS idx_places_rating ON tourist_places(rating DESC);

CREATE TABLE IF NOT EXISTS district_transport_costs (
  id BIGSERIAL PRIMARY KEY,
  source_district TEXT NOT NULL,
  destination_district TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (lower(tier) IN ('budget', 'comfort', 'luxury')),
  travel_cost INTEGER,
  stay_per_day INTEGER,
  day1_total INTEGER,
  day2_total INTEGER,
  day3_total INTEGER,
  day4_total INTEGER,
  day5_total INTEGER,
  day6_total INTEGER,
  day7_total INTEGER,
  day8_total INTEGER,
  day9_total INTEGER,
  day10_total INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (source_district, destination_district, tier)
);

CREATE INDEX IF NOT EXISTS idx_transport_src_dest
  ON district_transport_costs(lower(source_district), lower(destination_district), lower(tier));

CREATE TABLE IF NOT EXISTS district_hotels (
  id BIGSERIAL PRIMARY KEY,
  district TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (lower(category) IN ('budget', 'comfort', 'luxury')),
  star_rating NUMERIC(2,1),
  area TEXT,
  price_min INTEGER,
  price_max INTEGER,
  room_types TEXT,
  amenities TEXT,
  restaurant TEXT,
  ac_heating TEXT,
  parking TEXT,
  wifi TEXT,
  book_via TEXT,
  best_for TEXT,
  rating NUMERIC(2,1),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (district, hotel_name)
);

CREATE INDEX IF NOT EXISTS idx_hotels_district_category
  ON district_hotels(lower(district), lower(category));

CREATE TABLE IF NOT EXISTS district_transport_routes (
  id BIGSERIAL PRIMARY KEY,
  source_district TEXT NOT NULL,
  destination_district TEXT NOT NULL,
  distance_km INTEGER,
  bus_time TEXT,
  bus_tnstc_fare TEXT,
  bus_setc_ac_fare TEXT,
  taxi_fare_text TEXT,
  taxi_fare_min INTEGER,
  taxi_fare_max INTEGER,
  taxi_time TEXT,
  train_available TEXT,
  train_station_from TEXT,
  train_station_to TEXT,
  train_fare_text TEXT,
  train_time TEXT,
  flight_available TEXT,
  flight_airport_from TEXT,
  flight_airport_to TEXT,
  flight_fare_text TEXT,
  flight_time TEXT,
  best_route TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (source_district, destination_district)
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_src_dest
  ON district_transport_routes(lower(source_district), lower(destination_district));

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));

CREATE TABLE IF NOT EXISTS trip_plans (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  travelers INTEGER NOT NULL,
  budget INTEGER NOT NULL,
  plan_json JSONB NOT NULL,
  form_json JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_plans_user_created
  ON trip_plans(user_id, created_at DESC);
