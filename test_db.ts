import { sqliteDb } from './src/lib/sqlite';
const devices = sqliteDb.prepare('SELECT * FROM devices WHERE device_code = ?').all('Q5E5MJOUU5IZ4BCG');
console.log(devices);
