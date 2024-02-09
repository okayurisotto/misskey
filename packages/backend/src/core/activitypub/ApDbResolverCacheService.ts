import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { MemoryKVCache } from '@/misc/MemoryKVCache.js';
import type { user_publickey } from '@prisma/client';

@Injectable()
export class ApDbResolverCacheService implements OnApplicationShutdown {
	public readonly publicKeyCache: MemoryKVCache<user_publickey | null>;
	public readonly publicKeyByUserIdCache: MemoryKVCache<user_publickey | null>;

	constructor() {
		this.publicKeyCache = new MemoryKVCache<user_publickey | null>(Infinity);
		this.publicKeyByUserIdCache = new MemoryKVCache<user_publickey | null>(
			Infinity,
		);
	}

	public dispose(): void {
		this.publicKeyCache.dispose();
		this.publicKeyByUserIdCache.dispose();
	}

	public onApplicationShutdown(): void {
		this.dispose();
	}
}
