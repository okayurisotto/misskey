import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { MetaService } from '@/core/MetaService.js';
import { HostEntity } from '@/entities/HostEntity.js';

@Injectable()
export class HostFactory {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly metaService: MetaService,
	) {}

	public create(host: string | null): HostEntity {
		return new HostEntity(host, {
			configLoaderService: this.configLoaderService,
			metaService: this.metaService,
		});
	}
}
