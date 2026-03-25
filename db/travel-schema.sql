CREATE TABLE IF NOT EXISTS destinations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_state ON destinations(lower(state));
CREATE INDEX IF NOT EXISTS idx_destinations_name ON destinations(lower(name));

CREATE TABLE IF NOT EXISTS tourist_places (
  id BIGSERIAL PRIMARY KEY,
  destination_id BIGINT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (destination_id, name, address)
);

CREATE INDEX IF NOT EXISTS idx_places_destination ON tourist_places(destination_id);
CREATE INDEX IF NOT EXISTS idx_places_district ON tourist_places(lower(district));
CREATE INDEX IF NOT EXISTS idx_places_rating ON tourist_places(rating DESC);

CREATE TABLE IF NOT EXISTS district_transport_costs (
  id BIGSERIAL PRIMARY KEY,
  state TEXT NOT NULL,
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
  UNIQUE (state, source_district, destination_district, tier)
);

CREATE INDEX IF NOT EXISTS idx_transport_costs_state_src_dest
  ON district_transport_costs(lower(state), lower(source_district), lower(destination_district), lower(tier));

CREATE TABLE IF NOT EXISTS district_hotels (
  id BIGSERIAL PRIMARY KEY,
  state TEXT NOT NULL,
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
  UNIQUE (state, district, hotel_name)
);

CREATE INDEX IF NOT EXISTS idx_hotels_state_district_category
  ON district_hotels(lower(state), lower(district), lower(category));

CREATE TABLE IF NOT EXISTS district_transport_routes (
  id BIGSERIAL PRIMARY KEY,
  state TEXT NOT NULL,
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
  UNIQUE (state, source_district, destination_district)
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_state_src_dest
  ON district_transport_routes(lower(state), lower(source_district), lower(destination_district));
