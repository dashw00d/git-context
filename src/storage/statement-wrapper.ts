/* eslint-disable no-restricted-syntax */

import { getDatabase } from './database';

/**
 * Prepare a SQL statement using the database connection.
 * This is the recommended way to create prepared statements instead of db.prepare().
 * It prevents memory leaks from uninitialized statements.
 */
export function prepare(sql: string): any {
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db.prepare(sql);
}
