import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const pool = mysql.createPool({
  host: 'rm-bp1c9272p58gcdz1u5o.mysql.rds.aliyuncs.com',
  port: 3306,
  user: 'filmmarket',
  password: 'filmmarket@2006923',
  database: 'filmmarket',
  waitForConnections: true,
  connectionLimit: 2,
  connectTimeout: 30000,
});

async function testRegister() {
  const email = 'localtest_' + Date.now() + '@qq.com';
  const password = 'Test1234Ab';
  const nickname = '本地测试';

  try {
    console.log('=== Step 1: 检查邮箱是否已存在 ===');
    const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    console.log('Existing users:', existingUsers.length);

    console.log('\n=== Step 2: bcrypt hash ===');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Hash success, length:', hashedPassword.length);

    console.log('\n=== Step 3: INSERT user ===');
    const userId = uuidv4();
    const [insertResult] = await pool.query(
      'INSERT INTO users (id, email, password_hash, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [userId, email, hashedPassword, nickname]
    );
    console.log('Insert success:', insertResult);

    console.log('\n=== Step 4: SELECT back ===');
    const [newUsers] = await pool.query('SELECT id, email, nickname FROM users WHERE id = ?', [userId]);
    console.log('New user:', newUsers[0]);

    console.log('\n=== Step 5: Cleanup ===');
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    console.log('Cleanup done');

    console.log('\n✅ 所有步骤成功！注册流程本地通过');
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testRegister();
