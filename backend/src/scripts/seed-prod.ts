import { initDB } from '../db/init';

const run = async () => {
  try {
    console.log('Running production database initialization...');
    await initDB();
    console.log('Database initialization complete.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
};

run();
