-- Add review_links table to store individual employee review links
-- This script adds the new table to the existing schema

CREATE TABLE review_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    employee_name VARCHAR(100) NOT NULL,
    review_url TEXT NOT NULL,
    season VARCHAR(20) DEFAULT 'both' CHECK (season IN ('상반기', '하반기', 'both')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add index for performance
CREATE INDEX idx_review_links_user_id ON review_links(user_id);
CREATE INDEX idx_review_links_is_active ON review_links(is_active);

-- Add auto-update trigger for updated_at
CREATE TRIGGER update_review_links_updated_at 
    BEFORE UPDATE ON review_links 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE review_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for development" ON review_links FOR ALL USING (true);

-- Insert the provided review links for each employee
INSERT INTO review_links (user_id, employee_name, review_url) VALUES
('550e8400-e29b-41d4-a716-446655440001', '김경은', 'https://docs.google.com/spreadsheets/d/1bJlm3jhzV6jNRpv51cVONTAgJimuFqGZ7u8oNS7FW6I/edit?usp=sharing'),
('550e8400-e29b-41d4-a716-446655440002', '한종운', 'https://docs.google.com/spreadsheets/d/1fNc5AM4WdzXHyEHouzge2cAFUuOYRrZVPWZnrPcF6-8/edit?usp=drive_link'),
('550e8400-e29b-41d4-a716-446655440005', '이재혁', 'https://docs.google.com/spreadsheets/d/1Tal51cqmPYGkUmFgVppo9tES4BnhSk8GF1rIm3o3LE4/edit?usp=sharing'),
('550e8400-e29b-41d4-a716-446655440006', '허지현', 'https://docs.google.com/spreadsheets/d/1ZAmY0ANj4ja7Vu_H6vsXYIIWdAN4-DW11x0LMR1vNmU/edit?gid=0#gid=0'),
('550e8400-e29b-41d4-a716-446655440007', '유희수', 'https://docs.google.com/spreadsheets/d/1TZd2LrWfHNX3OX8HFgxkkSoSpIgehgKK/edit?usp=drivesdk&ouid=103726144211632898759&rtpof=true&sd=true'),
('550e8400-e29b-41d4-a716-446655440008', '윤서랑', 'https://docs.google.com/spreadsheets/d/1V36IoXnWYYwBpxhxRAYRGsC5SmS0dL1JnsUouq7cgQc/edit?gid=0#gid=0');

-- Verify the data was inserted
SELECT 
    'Review links table created and populated!' as message,
    (SELECT COUNT(*) FROM review_links) as review_links_count;