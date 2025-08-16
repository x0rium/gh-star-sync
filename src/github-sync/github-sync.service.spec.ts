import { Test, TestingModule } from '@nestjs/testing';
import { GithubSyncService } from './github-sync.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MetricsService } from '../metrics/metrics.service';

describe('GithubSyncService', () => {
  let service: GithubSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubSyncService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: HttpService, useValue: { get: jest.fn() } },
        {
          provide: PrismaService,
          useValue: { repository: { findMany: jest.fn() } },
        },
        { provide: SchedulerRegistry, useValue: { addCronJob: jest.fn() } },
        {
          provide: MetricsService,
          useValue: {
            syncRunsTotal: { inc: jest.fn() },
            syncDurationSeconds: { startTimer: jest.fn() },
            syncSuccessTotal: { inc: jest.fn() },
            syncErrorsTotal: { inc: jest.fn() },
            readmeFetchTotal: { inc: jest.fn() },
            rateLimitWaitsTotal: { inc: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<GithubSyncService>(GithubSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
