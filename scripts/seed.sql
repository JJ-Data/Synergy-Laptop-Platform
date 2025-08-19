-- First, get your company ID by running this query in Supabase SQL editor:
-- SELECT id, name FROM companies LIMIT 1;
-- Then replace 'YOUR_COMPANY_ID' below with the actual ID

-- Add sample laptops (replace YOUR_COMPANY_ID)
INSERT INTO laptops (company_id, name, brand, cpu, ram_gb, storage_gb, price_cents, active) VALUES
('YOUR_COMPANY_ID', 'MacBook Pro 14"', 'Apple', 'M3 Pro', 16, 512, 250000000, true),
('YOUR_COMPANY_ID', 'MacBook Air 13"', 'Apple', 'M2', 8, 256, 150000000, true),
('YOUR_COMPANY_ID', 'ThinkPad X1 Carbon', 'Lenovo', 'Intel i7', 16, 512, 180000000, true),
('YOUR_COMPANY_ID', 'Dell XPS 15', 'Dell', 'Intel i9', 32, 1000, 220000000, true),
('YOUR_COMPANY_ID', 'Surface Laptop 5', 'Microsoft', 'Intel i5', 8, 256, 130000000, true)
ON CONFLICT DO NOTHING;

-- Add a default policy if none exists (replace YOUR_COMPANY_ID)
INSERT INTO policies (company_id, max_amount_cents, interest_rate, durations_months)
VALUES ('YOUR_COMPANY_ID', 500000000, 5.0, '{6,12,18,24}')
ON CONFLICT (company_id) DO NOTHING;