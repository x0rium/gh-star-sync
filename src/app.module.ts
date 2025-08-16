import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GithubSyncModule } from './github-sync/github-sync.module';
import { PrismaModule } from './prisma/prisma.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    // 1. Модуль конфигурации для работы с .env
    ConfigModule.forRoot({ isGlobal: true }),
    // 2. Модуль для работы с Cron-задачами
    ScheduleModule.forRoot(),
    // 3. Модуль для HTTP запросов
    HttpModule,
    // 4. Наши кастомные модули
    GithubSyncModule,
    PrismaModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
