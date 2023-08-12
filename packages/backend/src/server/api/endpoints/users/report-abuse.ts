import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { MetaService } from '@/core/MetaService.js';
import { EmailService } from '@/core/EmailService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { RoleService } from '@/core/RoleService.js';
import { MisskeyIdSchema } from '@/models/zod/misc.js';
import { ApiError } from '../../error.js';
import { PrismaService } from '@/core/PrismaService.js';

export const meta = {
	tags: ['users'],
	requireCredential: true,
	description: 'File a report.',
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '1acefcb5-0959-43fd-9685-b48305736cb5',
		},
		cannotReportYourself: {
			message: 'Cannot report yourself.',
			code: 'CANNOT_REPORT_YOURSELF',
			id: '1e13149e-b1e8-43cf-902e-c01dbfcb202f',
		},
		cannotReportAdmin: {
			message: 'Cannot report the admin.',
			code: 'CANNOT_REPORT_THE_ADMIN',
			id: '35e166f5-05fb-4f87-a2d5-adb42676d48f',
		},
	},
} as const;

export const paramDef = z.object({
	userId: MisskeyIdSchema,
	comment: z.string().min(1).max(2048),
});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	z.ZodType<void>
> {
	constructor(
		private readonly idService: IdService,
		private readonly metaService: MetaService,
		private readonly emailService: EmailService,
		private readonly getterService: GetterService,
		private readonly roleService: RoleService,
		private readonly globalEventService: GlobalEventService,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Lookup user
			const user = await this.getterService.getUser(ps.userId).catch((err) => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') {
					throw new ApiError(meta.errors.noSuchUser);
				}
				throw err;
			});

			if (user.id === me.id) {
				throw new ApiError(meta.errors.cannotReportYourself);
			}

			if (await this.roleService.isAdministrator(user)) {
				throw new ApiError(meta.errors.cannotReportAdmin);
			}

			const report = await this.prismaService.client.abuse_user_report.create({
				data: {
					id: this.idService.genId(),
					createdAt: new Date(),
					targetUserId: user.id,
					targetUserHost: user.host,
					reporterId: me.id,
					reporterHost: null,
					comment: ps.comment,
				},
			});

			// Publish event to moderators
			setImmediate(async () => {
				const moderators = await this.roleService.getModerators();

				for (const moderator of moderators) {
					this.globalEventService.publishAdminStream(
						moderator.id,
						'newAbuseUserReport',
						{
							id: report.id,
							targetUserId: report.targetUserId,
							reporterId: report.reporterId,
							comment: report.comment,
						},
					);
				}

				const meta = await this.metaService.fetch();
				if (meta.email) {
					this.emailService.sendEmail(
						meta.email,
						'New abuse report',
						sanitizeHtml(ps.comment),
						sanitizeHtml(ps.comment),
					);
				}
			});
		});
	}
}
