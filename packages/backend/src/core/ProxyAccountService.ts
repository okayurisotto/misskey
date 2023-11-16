import { Injectable } from '@nestjs/common';
import type { LocalUser } from '@/models/entities/User.js';
import { MetaService } from '@/core/MetaService.js';
import { PrismaService } from '@/core/PrismaService.js';

@Injectable()
export class ProxyAccountService {
	constructor(
		private readonly metaService: MetaService,
		private readonly prismaService: PrismaService,
	) {}

	public async fetch(): Promise<LocalUser | null> {
		const meta = await this.metaService.fetch();
		if (meta.proxyAccountId == null) return null;
		return await this.prismaService.client.user.findUniqueOrThrow({ where: { id: meta.proxyAccountId } }) as LocalUser;
	}
}
