import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { genAid, parseAid } from '@/misc/id/aid.js';
import { genMeid, parseMeid } from '@/misc/id/meid.js';
import { genMeidg, parseMeidg } from '@/misc/id/meidg.js';
import { genObjectId, parseObjectId } from '@/misc/id/object-id.js';
import { bindThis } from '@/decorators.js';
import { parseUlid } from '@/misc/id/ulid.js';
import { idGenerationMethods } from '@/const.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class IdService {
	private readonly method: (typeof idGenerationMethods)[number];

	constructor(configLoaderService: ConfigLoaderService) {
		this.method = configLoaderService.data.id;
	}

	@bindThis
	public genId(date_?: Date): string {
		const date = ((): Date => {
			if (date_ === undefined) return new Date();
			if (date_ > new Date()) return new Date();
			return date_;
		})();

		switch (this.method) {
			case 'aid': return genAid(date);
			case 'meid': return genMeid(date);
			case 'meidg': return genMeidg(date);
			case 'ulid': return ulid(date.getTime());
			case 'objectid': return genObjectId(date);
			default: throw new Error('unrecognized id generation method');
		}
	}

	@bindThis
	public parse(id: string): { date: Date; } {
		switch (this.method) {
			case 'aid': return parseAid(id);
			case 'objectid': return parseObjectId(id);
			case 'meid': return parseMeid(id);
			case 'meidg': return parseMeidg(id);
			case 'ulid': return parseUlid(id);
			default: throw new Error('unrecognized id generation method');
		}
	}
}
