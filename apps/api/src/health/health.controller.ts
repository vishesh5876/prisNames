import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'api',
    };
  }
}
