function connection() {
  try {
    const mysql = require('mysql2');
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASS,
      database: process.env.MYSQL_DB

    });

    const promisePool = pool.promise();
    return promisePool;
  } catch (error) {    
    return console.log(error);
  }
}

const pool = connection();
module.exports = pool;