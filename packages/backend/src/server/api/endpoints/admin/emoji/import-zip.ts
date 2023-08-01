import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { QueueService } from '@/core/QueueService.js';
import { misskeyIdPattern } from '@/models/zod/misc.js';

export const meta = {
	secure: true,
	requireCredential: true,
	requireRolePolicy: 'canManageCustomEmojis',
} as const;

const paramDef_ = z.object({
	fileId: misskeyIdPattern,
});
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
			this.queueService.createImportCustomEmojisJob(me, ps.fileId);
		});
	}
}
