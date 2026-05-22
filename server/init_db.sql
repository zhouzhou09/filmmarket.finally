-- FilmMarket 数据库初始化 SQL
-- 在阿里云 RDS 控制台的"数据库管理 > 登录数据库"中执行此文件

-- 确保使用正确的数据库
USE filmmarket;

-- ===================== 基础表 =====================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  nickname VARCHAR(100) NOT NULL DEFAULT '',
  avatar_url VARCHAR(500) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  wechat_qr VARCHAR(500) DEFAULT '',
  seller_level ENUM('normal','verified','premium') NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  category VARCHAR(50) NOT NULL DEFAULT '',
  brand VARCHAR(100) DEFAULT '',
  model VARCHAR(100) DEFAULT '',
  `condition` VARCHAR(10) NOT NULL DEFAULT '9',
  type ENUM('sell','swap','free') NOT NULL DEFAULT 'sell',
  images JSON,
  views INT NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','sold','deleted') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favorites (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_user_product (user_id, product_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS swap_requests (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) DEFAULT NULL,
  requester_id VARCHAR(36) NOT NULL,
  offering VARCHAR(500) DEFAULT '',
  offering_image VARCHAR(500) DEFAULT '',
  wanted_category JSON,
  wanted_description TEXT,
  message TEXT,
  status ENUM('open','accepted','rejected') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product (product_id),
  INDEX idx_requester (requester_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== 订单相关表 =====================

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  buyer_id VARCHAR(36) NOT NULL,
  seller_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','confirmed','cancelled','refunded') NOT NULL DEFAULT 'pending',
  buyer_name VARCHAR(100) NOT NULL DEFAULT '',
  buyer_phone VARCHAR(20) NOT NULL DEFAULT '',
  buyer_address TEXT,
  buyer_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  confirmed_at TIMESTAMP NULL,
  INDEX idx_buyer (buyer_id),
  INDEX idx_seller (seller_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  reviewer_id VARCHAR(36) NOT NULL,
  reviewee_id VARCHAR(36) NOT NULL,
  rating TINYINT NOT NULL,
  content TEXT,
  role ENUM('buyer_to_seller','seller_to_buyer') NOT NULL DEFAULT 'buyer_to_seller',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order (order_id),
  INDEX idx_reviewee (reviewee_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== 聊天相关表 =====================

CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  user1_id VARCHAR(36) NOT NULL,
  user2_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) DEFAULT NULL,
  last_message TEXT,
  last_message_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user1 (user1_id),
  INDEX idx_user2 (user2_id),
  UNIQUE INDEX idx_unique_pair (user1_id, user2_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('text','image') NOT NULL DEFAULT 'text',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation (conversation_id),
  INDEX idx_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== 通知相关表 =====================

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  data JSON,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_user_read (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== 用户设置相关表 =====================

CREATE TABLE IF NOT EXISTS user_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  province VARCHAR(50) NOT NULL,
  city VARCHAR(50) NOT NULL,
  district VARCHAR(50) NOT NULL,
  detail VARCHAR(200) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('wechat','alipay','bank_card') NOT NULL,
  qr_code_url VARCHAR(500) DEFAULT '',
  bank_name VARCHAR(100) DEFAULT '',
  bank_account_encrypted VARCHAR(500) DEFAULT '',
  account_name VARCHAR(100) DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  order_update BOOLEAN NOT NULL DEFAULT true,
  price_alert BOOLEAN NOT NULL DEFAULT true,
  `message` BOOLEAN NOT NULL DEFAULT true,
  `system` BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== 完成 =====================
SELECT 'Database initialized successfully!' AS result;
