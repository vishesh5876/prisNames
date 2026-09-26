/**
 * PrisNames — Email Module
 *
 * Provides EmailProvider via NestJS DI.
 * Configured per EMAIL_PROVIDER env variable.
 */

import { Module, Global } from '@nestjs/common';
import { SmtpEmailProvider, type EmailProvider } from '@prisnames/email-core';
import { getEnv } from '@prisnames/config';

export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useFactory: (): EmailProvider => {
        const env = getEnv();
        // Currently only SMTP/Mailpit is supported
        return new SmtpEmailProvider({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          from: env.EMAIL_FROM,
        });
      },
    },
  ],
  exports: [EMAIL_PROVIDER_TOKEN],
})
export class EmailModule {}
