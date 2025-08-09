-- Custom Holidays Table for Managing Temporary Holidays
-- 임시공휴일 관리를 위한 테이블

-- Drop existing table if exists
DROP TABLE IF EXISTS custom_holidays CASCADE;

-- Create custom holidays table
CREATE TABLE custom_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'temporary', -- temporary(임시공휴일), substitute(대체공휴일), special(특별휴일)
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)) STORED,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, name) -- 같은 날짜에 같은 이름의 공휴일 중복 방지
);

-- Create indexes for better performance
CREATE INDEX idx_custom_holidays_date ON custom_holidays(date);
CREATE INDEX idx_custom_holidays_year ON custom_holidays(year);
CREATE INDEX idx_custom_holidays_active ON custom_holidays(is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_custom_holidays_updated_at 
  BEFORE UPDATE ON custom_holidays 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert 2025 temporary holidays
INSERT INTO custom_holidays (date, name, type, description) VALUES
  ('2025-01-27', '임시공휴일', 'temporary', '설 연휴 연장'),
  ('2025-06-03', '임시공휴일(대통령 선거)', 'temporary', '제21대 대통령 선거일'),
  ('2025-03-03', '대체공휴일', 'substitute', '삼일절 대체공휴일'),
  ('2025-05-06', '대체공휴일', 'substitute', '어린이날 대체공휴일'),
  ('2025-10-08', '대체공휴일', 'substitute', '추석 대체공휴일')
ON CONFLICT (date, name) DO NOTHING;

-- Grant permissions
GRANT ALL ON custom_holidays TO authenticated;
GRANT SELECT ON custom_holidays TO anon;

-- Create a view for easy querying
CREATE OR REPLACE VIEW v_all_holidays AS
SELECT 
  date,
  name,
  type,
  description,
  'custom' as source
FROM custom_holidays
WHERE is_active = true
ORDER BY date;

-- Function to get holidays for a specific year
CREATE OR REPLACE FUNCTION get_custom_holidays(target_year INTEGER)
RETURNS TABLE (
  date DATE,
  name VARCHAR(255),
  type VARCHAR(50),
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ch.date,
    ch.name,
    ch.type,
    ch.description
  FROM custom_holidays ch
  WHERE ch.year = target_year
    AND ch.is_active = true
  ORDER BY ch.date;
END;
$$ LANGUAGE plpgsql;

-- Function to add a custom holiday
CREATE OR REPLACE FUNCTION add_custom_holiday(
  p_date DATE,
  p_name VARCHAR(255),
  p_type VARCHAR(50) DEFAULT 'temporary',
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS custom_holidays AS $$
DECLARE
  v_holiday custom_holidays;
BEGIN
  INSERT INTO custom_holidays (date, name, type, description, created_by)
  VALUES (p_date, p_name, p_type, p_description, p_created_by)
  ON CONFLICT (date, name) 
  DO UPDATE SET
    type = EXCLUDED.type,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = NOW()
  RETURNING * INTO v_holiday;
  
  RETURN v_holiday;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM get_custom_holidays(2025);
-- SELECT add_custom_holiday('2025-12-31', '임시공휴일', 'temporary', '연말 특별휴일');