import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: 'rm-bp1c9272p58gcdz1u5o.mysql.rds.aliyuncs.com',
    port: 3306,
    user: 'filmmarket',
    password: 'filmmarket@2006923',
    database: 'filmmarket'
  });

  console.log('Connected to MySQL');

  // Check users.id type
  const [cols] = await conn.query("SHOW COLUMNS FROM users WHERE Field = 'id'");
  console.log('users.id type:', JSON.stringify(cols[0]));

  // Create user_addresses WITHOUT FK
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('user_addresses: OK');
  } catch (e) {
    console.error('user_addresses ERROR:', e.message);
  }

  // Create user_payment_methods WITHOUT FK
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('wechat', 'alipay', 'bank_card') NOT NULL,
        qr_code_url VARCHAR(500) DEFAULT '',
        bank_name VARCHAR(100) DEFAULT '',
        bank_account_encrypted VARCHAR(500) DEFAULT '',
        account_name VARCHAR(100) DEFAULT '',
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('user_payment_methods: OK');
  } catch (e) {
    console.error('user_payment_methods ERROR:', e.message);
  }

  // Create notification_settings WITHOUT FK, system with backticks
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        order_update BOOLEAN NOT NULL DEFAULT true,
        price_alert BOOLEAN NOT NULL DEFAULT true,
        \`message\` BOOLEAN NOT NULL DEFAULT true,
        \`system\` BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('notification_settings: OK');
  } catch (e) {
    console.error('notification_settings ERROR:', e.message);
  }

  // Verify
  const [tables] = await conn.query("SHOW TABLES");
  console.log('All tables:', tables.map(t => Object.values(t)[0]).join(', '));

  await conn.end();
  console.log('Done!');
}

main().catch(console.error);
