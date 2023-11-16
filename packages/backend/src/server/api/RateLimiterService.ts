import { Injectable } from '@nestjs/common';
import Limiter from 'ratelimiter';
import { NODE_ENV } from '@/env.js';
import type Logger from '@/misc/logger.js';
import { LoggerService } from '@/core/LoggerService.js';
import { RedisService } from '@/core/RedisService.js';
import type { IEndpointMeta } from './endpoints.js';

@Injectable()
export class RateLimiterService {
	private readonly logger: Logger;
	private readonly disabled = NODE_ENV !== 'production';

	constructor(
		private readonly redisClient: RedisService,

		private readonly loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('limiter');
	}

	public limit(limitation: IEndpointMeta['limit'] & { key: NonNullable<string> }, actor: string, factor = 1): Promise<void> {
		return new Promise<void>((ok, reject) => {
			if (this.disabled) ok();

			// Short-term limit
			const min = (): void => {
				const minIntervalLimiter = new Limiter({
					id: `${actor}:${limitation.key}:min`,
					duration: limitation.minInterval! * factor,
					max: 1,
					db: this.redisClient,
				});

				minIntervalLimiter.get((err, info) => {
					if (err) {
						return reject('ERR');
					}

					this.logger.debug(`${actor} ${limitation.key} min remaining: ${info.remaining}`);

					if (info.remaining === 0) {
						reject('BRIEF_REQUEST_INTERVAL');
					} else {
						if (hasLongTermLimit) {
							max();
						} else {
							ok();
						}
					}
				});
			};

			// Long term limit
			const max = (): void => {
				const limiter = new Limiter({
					id: `${actor}:${limitation.key}`,
					duration: limitation.duration! * factor,
					max: limitation.max! / factor,
					db: this.redisClient,
				});

				limiter.get((err, info) => {
					if (err) {
						return reject('ERR');
					}

					this.logger.debug(`${actor} ${limitation.key} max remaining: ${info.remaining}`);

					if (info.remaining === 0) {
						reject('RATE_LIMIT_EXCEEDED');
					} else {
						ok();
					}
				});
			};

			const hasShortTermLimit = typeof limitation.minInterval === 'number';

			const hasLongTermLimit =
				typeof limitation.duration === 'number' &&
				typeof limitation.max === 'number';

			if (hasShortTermLimit) {
				min();
			} else if (hasLongTermLimit) {
				max();
			} else {
				ok();
			}
		});
	}
}
