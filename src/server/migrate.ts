import dotenv from 'dotenv';
import { initializeDatabase } from './database/db.js';

dotenv.config();

async function migrate() {
  try {
    console.log('🔄 Running database migrations...');
    await initializeDatabase();
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
