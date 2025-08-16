import { Injectable } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  // Sync Metrics
  public readonly syncRunsTotal: Counter<string>;
  public readonly syncSuccessTotal: Counter<string>;
  public readonly syncErrorsTotal: Counter<string>;
  public readonly syncDurationSeconds: Histogram<string>;
  public readonly readmeFetchTotal: Counter<string>;
  public readonly rateLimitWaitsTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({
      app: 'gh-star-sync',
    });
    collectDefaultMetrics({ register: this.registry });

    this.syncRunsTotal = new Counter({
      name: 'sync_runs_total',
      help: 'Total number of synchronization runs started.',
      registers: [this.registry],
    });

    this.syncSuccessTotal = new Counter({
      name: 'sync_success_total',
      help: 'Total number of successful synchronization runs.',
      registers: [this.registry],
    });

    this.syncErrorsTotal = new Counter({
      name: 'sync_errors_total',
      help: 'Total number of failed synchronization runs.',
      registers: [this.registry],
    });

    this.syncDurationSeconds = new Histogram({
      name: 'sync_duration_seconds',
      help: 'Duration of synchronization runs in seconds.',
      registers: [this.registry],
      buckets: [0.1, 5, 15, 50, 100, 300, 600], // buckets in seconds
    });

    this.readmeFetchTotal = new Counter({
      name: 'readme_fetch_total',
      help: 'Total number of README files fetched.',
      registers: [this.registry],
    });

    this.rateLimitWaitsTotal = new Counter({
      name: 'rate_limit_waits_total',
      help: 'Total number of times the service waited for GitHub API rate limit reset.',
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
