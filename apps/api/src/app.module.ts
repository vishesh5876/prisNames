import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { EmailModule } from './email/email.module.js';
import { AuthEmailQueueModule } from './queues/auth-email-queue.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { WebhookModule } from './modules/webhooks/webhook.module.js';
import { RegistrarModule } from './modules/registrar/registrar.module.js';

@Module({
  imports: [
    // Infrastructure (Global modules)
    DatabaseModule,
    RedisModule,
    EmailModule,
    AuthEmailQueueModule,

    // Feature modules
    HealthModule,
    AuthModule,
    WebhookModule,
    RegistrarModule,
  ],
})
export class AppModule {}
