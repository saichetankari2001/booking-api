-- Prevent double-booking races: PostgreSQL's default Read Committed isolation lets two
-- concurrent transactions both pass a "is this table available" check before either has
-- inserted/updated a confirmed booking, resulting in two confirmed bookings for the same
-- table+slot+date. Prisma's schema DSL cannot express a partial/conditional unique
-- constraint, so this is a hand-written migration.
--
-- This is a partial unique index (only applies to status = 'confirmed') rather than a
-- plain unique constraint on (table_id, slot_id, date), because cancelled bookings must
-- not block a new confirmed booking from reusing the same table+slot+date.
CREATE UNIQUE INDEX "bookings_confirmed_table_slot_date_key" ON "bookings"("table_id", "slot_id", "date") WHERE "status" = 'confirmed';
