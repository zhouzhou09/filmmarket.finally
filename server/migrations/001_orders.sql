-- FilmMarket 订单系统迁移
-- 2026-05-11

USE filmmarket;

-- 1. 给 users 表加微信收款码字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_qr VARCHAR(500) DEFAULT '' COMMENT '微信收款二维码URL' AFTER avatar_url;

-- 2. 创建 orders 表
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY COMMENT '订单ID',
  product_id VARCHAR(36) NOT NULL COMMENT '商品ID',
  buyer_id VARCHAR(36) NOT NULL COMMENT '买家ID',
  seller_id VARCHAR(36) NOT NULL COMMENT '卖家ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
  status ENUM('pending', 'paid', 'confirmed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending' COMMENT '订单状态',
  buyer_name VARCHAR(100) NOT NULL COMMENT '买家收货人',
  buyer_phone VARCHAR(20) NOT NULL COMMENT '买家手机号',
  buyer_address TEXT NOT NULL COMMENT '买家收货地址',
  buyer_note TEXT COMMENT '买家备注/留言',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL COMMENT '买家付款时间',
  confirmed_at TIMESTAMP NULL COMMENT '卖家确认时间',
  INDEX idx_buyer (buyer_id),
  INDEX idx_seller (seller_id),
  INDEX idx_status (status),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 给 products 表加 status 字段（用于下架/售出标记）
ALTER TABLE products ADD COLUMN IF NOT EXISTS status ENUM('active', 'sold', 'deleted') NOT NULL DEFAULT 'active' AFTER is_featured;

SELECT 'Migration completed: orders + wechat_qr + product status' AS result;
