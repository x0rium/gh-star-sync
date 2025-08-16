import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) {
      this.logger.warn(
        'Skipping database connection in test environment or when DATABASE_URL is not set.',
      );
      return;
    }
    await this.$connect();
  }
}
