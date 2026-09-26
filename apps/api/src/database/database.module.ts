/**
 * PrisNames — Database Module
 *
 * Provides Drizzle Database instance via NestJS dependency injection.
 */

import { Module, Global, type OnModuleDestroy } from '@nestjs/common';
import { getDb, closeDb, type Database } from '@prisnames/database/client';
import { getEnv } from '@prisnames/config';

export const DATABASE_TOKEN = 'DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (): Database => {
        return getDb(getEnv().DATABASE_URL);
      },
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await closeDb();
  }
}
