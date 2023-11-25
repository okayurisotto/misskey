import { Injectable } from '@nestjs/common';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { RoleService } from '@/core/RoleService.js';
import type { AbuseUserReport } from '@prisma/client';

@Injectable()
export class AbuseUserReportCreationService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
		private readonly roleService: RoleService,
	) {}

	/**
	 * 通報を作成する。
	 *
	 * @throws 自分自身を通報しようとしていた場合
	 * @throws 管理者ユーザーを通報しようとしていた場合
	 */
	public async create(data: {
		comment: string;
		reporterId: string;
		targetUserId: string;
	}): Promise<AbuseUserReport> {
		if (data.reporterId === data.targetUserId) {
			throw new Error('reporterId === targetUserId is true');
		}

		const targetUser = await this.prismaService.client.user.findUniqueOrThrow({
			where: { id: data.targetUserId },
		});

		if (await this.roleService.isAdministrator(targetUser)) {
			throw new Error('isAdministrator(targetUser) is true');
		}

		const result = await this.prismaService.client.abuseUserReport.create({
			data: {
				id: this.idService.genId(),
				createdAt: new Date(),
				comment: data.comment,
				reporter: {
					connect: { id: data.reporterId },
				},
				targetUser: {
					connect: { id: data.targetUserId },
				},
			},
		});

		return result;
	}
}
