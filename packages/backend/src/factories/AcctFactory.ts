import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { MetaService } from '@/core/MetaService.js';
import { AcctEntity } from '@/entities/AcctEntity.js';

@Injectable()
export class AcctFactory {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,
		private readonly metaService: MetaService,
	) {}

	public create(username: string, host: string | null): AcctEntity {
		return new AcctEntity(
			{ username, host },
			{
				configLoaderService: this.configLoaderService,
				metaService: this.metaService,
			},
		);
	}

	public parse(value: string): AcctEntity {
		if (value.startsWith('@')) {
			return this.parse(value.substring(1));
		}

		const split = value.split('@', 2);

		const username = split[0];
		if (username === undefined) throw new Error();

		const host = split[1] ?? null;

		return new AcctEntity(
			{ username, host },
			{
				configLoaderService: this.configLoaderService,
				metaService: this.metaService,
			},
		);
	}
}
