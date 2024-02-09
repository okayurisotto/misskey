import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import { MemoryKVCacheF } from '@/misc/cache/MemoryKVCacheF.js';
import type { user_publickey } from '@prisma/client';

@Injectable()
export class ApDbResolverCacheService implements OnApplicationShutdown {
	public readonly publicKeyCache;
	public readonly publicKeyByUserIdCache;

	constructor(private readonly prismaService: PrismaService) {
		this.publicKeyCache = new MemoryKVCacheF<
			user_publickey,
			user_publickey | undefined
		>(null, async (key) => {
			const result = await this.prismaService.client.user_publickey.findUnique({
				where: { keyId: key },
			});
			return result ?? undefined;
		});
		this.publicKeyByUserIdCache = new MemoryKVCacheF<
			user_publickey,
			user_publickey | undefined
		>(null, async (key) => {
			const result = await this.prismaService.client.user_publickey.findUnique({
				where: { userId: key },
			});
			return result ?? undefined;
		});
	}

	public dispose(): void {
		this.publicKeyCache.dispose();
		this.publicKeyByUserIdCache.dispose();
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
