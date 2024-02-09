import { Injectable } from '@nestjs/common';
import { pick } from 'omick';
import {
	AppIsAuthorizedOnlySchema,
	AppLiteSchema,
	AppSecretOnlySchema,
} from '@/models/zod/AppSchema.js';
import { PrismaService } from '@/core/PrismaService.js';
import { EntityMap } from '@/misc/EntityMap.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { unique } from '@/misc/prelude/array.js';
import { IdService } from '../IdService.js';
import type { z } from 'zod';
import type { Prisma, access_token, App, user } from '@prisma/client';

@Injectable()
export class AppEntityService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async create(
		data: Pick<
			Prisma.AppCreateInput,
			'name' | 'description' | 'callbackUrl'
		> & {
			permission: string[];
		},
		meId: string | null,
	): Promise<
		z.infer<typeof AppLiteSchema> & z.infer<typeof AppSecretOnlySchema>
	> {
		// Generate secret
		const secret = secureRndstr(32);

		// for backward compatibility
		const permission = unique(
			data.permission.map((v) =>
				v.replace(/^(.+)(\/|-)(read|write)$/, '$3:$1'),
			),
		);

		const result = await this.prismaService.client.app.create({
			data: {
				...data,
				id: this.idService.genId(),
				createdAt: new Date(),
				userId: meId,
				permission,
				secret,
			},
		});

		const packData = {
			app: new EntityMap('id', [result]),
		};

		return {
			...this.packLite(result.id, packData),
			...this.packSecretOnly(result.id, packData),
		};
	}

	public isAuthorized(
		appId: string,
		userId: string,
		tokens: access_token[],
	): boolean {
		return tokens.some((token) => {
			if (token.appId !== appId) return false;
			if (token.userId !== userId) return false;
			return true;
		});
	}

	public packLite(
		id: string,
		data: { app: EntityMap<'id', App> },
	): z.infer<typeof AppLiteSchema> {
		const app = data.app.get(id);
		return pick(app, ['id', 'name', 'callbackUrl', 'permission']);
	}

	public packSecretOnly(
		id: string,
		data: { app: EntityMap<'id', App> },
	): z.infer<typeof AppSecretOnlySchema> {
		const app = data.app.get(id);
		return pick(app, ['secret']);
	}

	public packAuthorizedOnly(
		appId: string,
		userId: string,
		data: {
			access_token: EntityMap<'id', access_token>;
		},
	): z.infer<typeof AppIsAuthorizedOnlySchema> {
		return {
			isAuthorized: this.isAuthorized(appId, userId, [
				...data.access_token.values(),
			]),
		};
	}
}
