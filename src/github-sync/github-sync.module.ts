import { Module } from '@nestjs/common';
import { GithubSyncService } from './github-sync.service';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { RateLimitInterceptor } from './rate-limit.interceptor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    MetricsModule,
    HttpModule,
    PrismaModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        baseURL: 'https://api.github.com',
        headers: {
          Authorization: `token ${configService.get<string>('GITHUB_TOKEN')}`,
          'X-GitHub-Api-Version': '2022-11-28',
          Accept: 'application/vnd.github.v3.star+json', // Для получения starred_at
        },
        // Важно: отключаем стандартную проверку статуса, будем делать это сами
        validateStatus: () => true,
      }),
      inject: [ConfigService],
    }),
  ], // Импортируем HttpModule и PrismaModule
  providers: [
    GithubSyncService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
  exports: [GithubSyncService],
})
export class GithubSyncModule {}
