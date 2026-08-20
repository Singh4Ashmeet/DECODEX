import { initDBWithRetry } from '../db/init';

const run = async () => {
  try {
    console.log('Running database migrations...');
    await initDBWithRetry({ label: 'Database migration' });
    console.log('Database migrations complete.');
    process.exit(0);
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  }
};

run();
