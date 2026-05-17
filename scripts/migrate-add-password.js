/**
 * 数据库迁移：为 users 表添加 password_hash 字段
 */
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'rm-bp1c9272p58gcdz1u5o.mysql.rds.aliyuncs.com',
  port: 3306,
  user: 'filmmarket',
  password: 'filmmarket@2006923',
  database: 'filmmarket',
});

async function migrate() {
  console.log('开始数据库迁移...');
  try {
    // 检查字段是否已存在
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'filmmarket' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_hash'
    `);

    if (cols.length === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email');
      console.log('✅ 添加 password_hash 字段成功');
    } else {
      console.log('ℹ️  password_hash 字段已存在，跳过');
    }

    // 同样检查 likes 字段
    const [likeCols] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'filmmarket' AND TABLE_NAME = 'products' AND COLUMN_NAME = 'likes'
    `);

    if (likeCols.length === 0) {
      await pool.query('ALTER TABLE products ADD COLUMN likes INT DEFAULT 0');
      console.log('✅ 添加 products.likes 字段成功');
    } else {
      console.log('ℹ️  products.likes 字段已存在，跳过');
    }

    // 检查 is_featured 字段
    const [featuredCols] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'filmmarket' AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_featured'
    `);

    if (featuredCols.length === 0) {
      await pool.query('ALTER TABLE products ADD COLUMN is_featured BOOLEAN DEFAULT FALSE');
      console.log('✅ 添加 products.is_featured 字段成功');
    } else {
      console.log('ℹ️  products.is_featured 字段已存在，跳过');
    }

    // 检查 tags 字段
    const [tagCols] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'filmmarket' AND TABLE_NAME = 'products' AND COLUMN_NAME = 'tags'
    `);

    if (tagCols.length === 0) {
      await pool.query('ALTER TABLE products ADD COLUMN tags JSON NULL');
      console.log('✅ 添加 products.tags 字段成功');
    } else {
      console.log('ℹ️  products.tags 字段已存在，跳过');
    }

    // 检查 location 字段
    const [locCols] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'filmmarket' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'location'
    `);

    if (locCols.length === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN location VARCHAR(100) NULL');
      console.log('✅ 添加 users.location 字段成功');
    } else {
      console.log('ℹ️  users.location 字段已存在，跳过');
    }

    console.log('\n🎉 数据库迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
  } finally {
    await pool.end();
  }
}

migrate();
