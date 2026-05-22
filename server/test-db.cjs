const mysql = require('mysql2');

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

async function test() {
  try {
    console.log('Step 1: SELECT...');
    const selectResult = await pool.query('SELECT 1 as test');
    console.log('SELECT result type:', typeof selectResult, 'isArray:', Array.isArray(selectResult));
    console.log('SELECT result:', JSON.stringify(selectResult).substring(0, 500));

    console.log('\nStep 2: INSERT...');
    const insertResult = await pool.query(
      'INSERT INTO users (id, email, password_hash, nickname) VALUES (?, ?, ?, ?)',
      ['test-' + Date.now(), 'debug_' + Date.now() + '@test.com', 'hash123', 'debug']
    );
    console.log('INSERT result type:', typeof insertResult, 'isArray:', Array.isArray(insertResult));
    console.log('INSERT result:', JSON.stringify(insertResult).substring(0, 500));

    console.log('\nAll tests passed!');
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  } finally {
    pool.end();
  }
}

test();
