process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/booking_api_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
