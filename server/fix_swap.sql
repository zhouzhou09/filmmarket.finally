-- 修复 swap_requests 表，让 product_id 可空，status 支持 'open'
USE filmmarket;

-- 1. 让 product_id 可空（从换物广场直接发起时没有关联商品）
ALTER TABLE swap_requests MODIFY COLUMN product_id VARCHAR(36) DEFAULT NULL;

-- 2. 把 status 的 ENUM 从 'pending' 改成 'open'
ALTER TABLE swap_requests MODIFY COLUMN status ENUM('open','accepted','rejected') NOT NULL DEFAULT 'open';

SELECT 'swap_requests table fixed!' AS result;
