import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const axiosRef = this.httpService.axiosRef;
    return next.handle().pipe(
      catchError((error: AxiosError) => {
        const response = error.response;
        const config = error.config;

        if (
          response &&
          config &&
          response.status === 403 &&
          response.headers['x-ratelimit-remaining'] === '0'
        ) {
          const resetTime = parseInt(response.headers['x-ratelimit-reset'], 10);
          const currentTime = Math.floor(Date.now() / 1000);
          const waitTimeMs = Math.max(0, resetTime - currentTime) * 1000 + 1000; // +1 second buffer

          this.logger.warn(
            `GitHub API rate limit exceeded. Waiting for ${Math.round(
              waitTimeMs / 1000,
            )} seconds...`,
          );
          this.metricsService.rateLimitWaitsTotal.inc();

          return new Observable((subscriber) => {
            setTimeout(() => {
              this.logger.log('Rate limit reset. Retrying request...');
              axiosRef.request(config).then(
                (res) => {
                  subscriber.next(res);
                  subscriber.complete();
                },
                (err) => {
                  subscriber.error(err);
                },
              );
            }, waitTimeMs);
          });
        }
        return throwError(() => error);
      }),
    );
  }
}
