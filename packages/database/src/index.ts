/**
 * PrisNames — Package Entry Point
 *
 * Re-exports schema, relations, client, and enums.
 */

// Schema tables
export * from './schema/index.js';

// Relations
export * from './relations/index.js';

// Client
export { createDb, getDb, closeDb, type Database } from './client.js';
