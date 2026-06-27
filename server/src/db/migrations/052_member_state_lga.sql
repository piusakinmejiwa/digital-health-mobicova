-- Member location: state + Local Government Area (Nigeria). Sits alongside the
-- existing address/city columns; both default to '' so existing rows are fine.
ALTER TABLE members ADD COLUMN IF NOT EXISTS state VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS lga   VARCHAR(80) NOT NULL DEFAULT '';
