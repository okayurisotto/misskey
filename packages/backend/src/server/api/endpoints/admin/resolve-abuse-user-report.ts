import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { InstanceActorService } from '@/core/InstanceActorService.js';
import { QueueService } from '@/core/QueueService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = z.object({
	reportId: MisskeyIdSchema,
	forward: z.boolean().default(false),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly queueService: QueueService,
		private readonly instanceActorService: InstanceActorService,
		private readonly apRendererService: ApRendererService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const report =
				await this.prismaService.client.abuse_user_report.findUnique({
					where: { id: ps.reportId },
				});

			if (report == null) {
				throw new Error('report not found');
			}

			if (ps.forward && report.targetUserHost != null) {
				const actor = await this.instanceActorService.getInstanceActor();
				const targetUser =
					await this.prismaService.client.user.findUniqueOrThrow({
						where: { id: report.targetUserId },
					});

				this.queueService.deliver(
					actor,
					this.apRendererService.addContext(
						this.apRendererService.renderFlag(
							actor,
							targetUser.uri!,
							report.comment,
						),
					),
					targetUser.inbox,
					false,
				);
			}

			await this.prismaService.client.abuse_user_report.update({
				where: { id: report.id },
				data: {
					resolved: true,
					assigneeId: me.id,
					forwarded: ps.forward && report.targetUserHost !== null,
				},
			});
		});
	}
}
