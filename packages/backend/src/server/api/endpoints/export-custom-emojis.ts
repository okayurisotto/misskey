import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueueService } from '@/core/QueueService.js';

export const meta = {
	secure: true,
	requireCredential: true,
	limit: {
		duration: ms('1hour'),
		max: 1,
	},
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	z.ZodType<void>
> {
	constructor(private queueService: QueueService) {
		super(meta, paramDef_, async (ps, me) => {
			this.queueService.createExportCustomEmojisJob(me);
		});
	}
}
