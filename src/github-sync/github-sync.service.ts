import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom, catchError } from 'rxjs';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AxiosError } from 'axios';
// NOTE: Removed direct Prisma types import to avoid TS export resolution issues under nodenext
import { MetricsService } from '../metrics/metrics.service';

function parseBool(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return defaultValue;
  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'y':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'n':
    case 'off':
      return false;
    default:
      return defaultValue;
  }
}

interface StarredRepoResponse {
  starred_at: string;
  repo: GithubRepo;
}

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  created_at: string;
  pushed_at: string;
}

type RepoInputData = any;

@Injectable()
export class GithubSyncService implements OnModuleInit {
  private readonly logger = new Logger(GithubSyncService.name);
  private readonly githubToken: string;
  private readonly githubUsername: string;
  private readonly githubApiBaseUrl = 'https://api.github.com';

  private readonly syncOnBoot: boolean;
  private readonly syncCronEnabled: boolean;
  private readonly cronSchedule: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly metricsService: MetricsService,
  ) {
    this.githubToken = this.configService.get<string>('GITHUB_TOKEN') || '';
    this.githubUsername =
      this.configService.get<string>('GITHUB_USERNAME') || '';

    this.syncOnBoot = parseBool(this.configService.get('ENABLE_SYNC_ON_BOOT'));
    this.syncCronEnabled = parseBool(this.configService.get('ENABLE_SYNC_CRON'));
    this.cronSchedule = (this.configService.get<string>('CRON_SCHEDULE', '*/5 * * * *') ?? '*/5 * * * *').replace(/^['"]|['"]$/g, '');

    if (!this.githubToken || !this.githubUsername) {
      this.logger.warn(
        'GITHUB_TOKEN or GITHUB_USERNAME is not set. Disabling GitHub sync features.',
      );
    }
  }

  async onModuleInit() {
    this.logger.log(`Resolved config: ENABLE_SYNC_ON_BOOT=${this.syncOnBoot}, ENABLE_SYNC_CRON=${this.syncCronEnabled}, CRON_SCHEDULE=${this.cronSchedule}, GITHUB_USERNAME=${this.githubUsername ? 'set' : 'missing'}, GITHUB_TOKEN=${this.githubToken ? 'set' : 'missing'}`);
    if (this.syncOnBoot) {
      this.logger.log('Initial synchronization on boot is enabled.');
      await this.syncStarredRepos().catch((err: unknown) => {
        const stack = err instanceof Error ? err.stack : String(err);
        this.logger.error('Error during initial synchronization', stack);
      });
    } else {
      this.logger.log('Initial synchronization on boot is disabled.');
    }

    if (this.syncCronEnabled) {
      this.logger.log(
        `Scheduling cron job with schedule: ${this.cronSchedule}`,
      );
      const job = new CronJob(this.cronSchedule, () => {
        this.logger.log('Scheduled synchronization by Cron is starting...');
        this.syncStarredRepos().catch((err: unknown) => {
          const stack = err instanceof Error ? err.stack : String(err);
          this.logger.error('Error during scheduled synchronization', stack);
        });
      });
      this.schedulerRegistry.addCronJob('sync-starred-repos', job as any);
      job.start();
    } else {
      this.logger.log('Scheduled synchronization by Cron is disabled.');
    }
  }

  async syncStarredRepos() {
    if (!this.githubToken || !this.githubUsername) {
      return;
    }
    this.logger.log('Step 1/4: Fetching starred repositories...');
    this.metricsService.syncRunsTotal.inc();
    const end = this.metricsService.syncDurationSeconds.startTimer();

    try {
      const githubReposData = await this.fetchAllStarred();
      const githubRepoIds = new Set(
        githubReposData.map((data) => BigInt(data.repo.id)),
      );
      this.logger.log(`Fetched ${githubReposData.length} repositories.`);
      this.logger.log('Step 2/4: Fetching current state from DB...');
      const dbRepos: any[] = await (this.prisma as any).repository.findMany();
      const dbReposMap = new Map<bigint, any>(
        dbRepos.map((repo) => [repo.githubId, repo]),
      );

      const reposToCreate: RepoInputData[] = [];
      const reposToUpdate: RepoInputData[] = [];
      for (const data of githubReposData) {
        const repo = data.repo;
        const existingRepo = dbReposMap.get(BigInt(repo.id));
        const githubPushedAt = new Date(repo.pushed_at);
        const repoData: RepoInputData = {
          githubId: BigInt(repo.id),
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          language: repo.language,
          stars: repo.stargazers_count,
          repoCreatedAt: new Date(repo.created_at),
          repoPushedAt: githubPushedAt,
          repoStarredAt: new Date(data.starred_at),
        };
        if (!existingRepo) {
          reposToCreate.push(repoData);
        } else if (githubPushedAt > existingRepo.repoPushedAt) {
          reposToUpdate.push(repoData);
        }
      }
      this.logger.log(
        `Found: ${reposToCreate.length} new, ${reposToUpdate.length} updated repositories.`,
      );
      this.logger.log('Step 3/4: Enriching data (fetching READMEs)...');
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const reposToFetchReadme = [
        ...reposToCreate,
        ...reposToUpdate.filter((repo) => {
          const dbRepo = dbReposMap.get(BigInt(repo.githubId));
          return (
            !dbRepo ||
            !dbRepo.readmeFetchedAt ||
            dbRepo.readmeFetchedAt < oneDayAgo
          );
        }),
      ];

      const uniqueReposToFetch = new Map(
        reposToFetchReadme.map((r) => [r.githubId, r]),
      );
      const readmeResults = new Map<bigint, string | null>();
      for (const repo of uniqueReposToFetch.values()) {
        const readmeContent = await this.fetchReadmeContent(
          repo.fullName.split('/')[0],
          repo.name,
        );
        readmeResults.set(BigInt(repo.githubId), readmeContent);
      }
      this.logger.log(`Fetched ${readmeResults.size} README files.`);
      this.metricsService.readmeFetchTotal.inc(readmeResults.size);

      this.logger.log('Step 4/4: Synchronizing with the database...');
      await (this.prisma as any).$transaction(async (tx: any) => {
        if (reposToCreate.length > 0) {
          const dataToCreate = reposToCreate.map((repo) => ({
            ...repo,
            readmeContent: readmeResults.get(BigInt(repo.githubId)),
            readmeFetchedAt: new Date(),
          }));
          await tx.repository.createMany({ data: dataToCreate });
        }
        if (reposToUpdate.length > 0) {
          for (const repo of reposToUpdate) {
            const readmeData: {
              readmeContent?: string | null;
              readmeFetchedAt?: Date;
            } = {};
            if (readmeResults.has(BigInt(repo.githubId))) {
              readmeData.readmeContent = readmeResults.get(
                BigInt(repo.githubId),
              );
              readmeData.readmeFetchedAt = new Date();
            }
            await tx.repository.update({
              where: { githubId: repo.githubId },
              data: { ...repo, ...readmeData },
            });
          }
        }

        const repoIdsToDelete = Array.from(dbReposMap.keys()).filter(
          (id) => !githubRepoIds.has(id),
        );
        if (repoIdsToDelete.length > 0) {
          await tx.repository.deleteMany({
            where: { githubId: { in: repoIdsToDelete } },
          });
        }
      });
      this.logger.log('Synchronization successfully completed.');
      this.metricsService.syncSuccessTotal.inc();
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Synchronization failed', stack);
      this.metricsService.syncErrorsTotal.inc();
    } finally {
      end();
    }
  }

  private async fetchAllStarred(): Promise<StarredRepoResponse[]> {
    const allRepos: StarredRepoResponse[] = [];
    let page = 1;
    const perPage = 100;
    while (true) {
      const url = `${this.githubApiBaseUrl}/users/${this.githubUsername}/starred?per_page=${perPage}&page=${page}`;
      const response = await firstValueFrom(
        this.httpService.get<StarredRepoResponse[]>(url, {
          headers: {
            Authorization: `token ${this.githubToken}`,
            Accept: 'application/vnd.github.v3.star+json',
          },
        }),
      );
      if (response.data.length === 0) break;
      allRepos.push(...response.data);
      page++;
    }
    return allRepos;
  }

  private async fetchReadmeContent(
    owner: string,
    repoName: string,
  ): Promise<string | null> {
    const url = `${this.githubApiBaseUrl}/repos/${owner}/${repoName}/readme`;
    try {
      const response = await firstValueFrom(
        this.httpService
          .get<{ content?: string }>(url, {
            headers: { Authorization: `token ${this.githubToken}` },
          })
          .pipe(
            catchError((error: AxiosError) => {
              if (error.response?.status === 404) {
                this.logger.warn(`README not found for ${owner}/${repoName}`);
              } else {
                this.logger.error(
                  `Error fetching README for ${owner}/${repoName}`,
                  error.message,
                );
              }
              return Promise.resolve({ data: { content: null } });
            }),
          ),
      );
      if (!response.data || !response.data.content) return null;
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    } catch (error: unknown) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Critical error in fetchReadmeContent for ${owner}/${repoName}`,
        stack,
      );
      return null;
    }
  }
}
