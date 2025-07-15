-- 비밀번호 해시 수정 - Supabase SQL Editor에서 실행하세요
-- 모든 사용자의 비밀번호를 '0000'으로 설정

UPDATE users 
SET password_hash = '$2b$10$OlWjrANp4EKs8ZZZOSXX1.JaGkkjmeuMqigab4J2qtNqDj2HQ2L52'
WHERE email IN (
    'lewis@motionsense.co.kr',
    'ke.kim@motionsense.co.kr', 
    'jw.han@motionsense.co.kr',
    'ht.no@motionsense.co.kr',
    'jh.park@motionsense.co.kr',
    'jh.lee@motionsense.co.kr',
    'jh.heo@motionsense.co.kr',
    'hs.ryoo@motionsense.co.kr',
    'sr.yun@motionsense.co.kr'
);

-- 확인
SELECT email, name, LEFT(password_hash, 20) as hash_preview FROM users;