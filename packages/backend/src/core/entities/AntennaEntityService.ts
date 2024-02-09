import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { pick } from 'omick';
import type { AntennaSchema } from '@/models/zod/AntennaSchema.js';
import { EntityMap } from '@/misc/EntityMap.js';
import type { Antenna } from '@prisma/client';

const AntennaKeywordsSchema = z.array(z.array(z.string()));

@Injectable()
export class AntennaEntityService {
	/**
	 * `antenna`をpackする。
	 * 現状、`hasUnreadNote`は常に`false`になる。
	 */
	public pack(
		id: string,
		data: { antenna: EntityMap<'id', Antenna> },
	): z.infer<typeof AntennaSchema> {
		const antenna = data.antenna.get(id);

		return {
			...pick(antenna, [
				'id',
				'name',
				'src',
				'userListId',
				'users',
				'caseSensitive',
				'notify',
				'withReplies',
				'withFile',
				'isActive',
			]),
			createdAt: antenna.createdAt.toISOString(),
			keywords: AntennaKeywordsSchema.parse(antenna.keywords),
			excludeKeywords: AntennaKeywordsSchema.parse(antenna.excludeKeywords),
			hasUnreadNote: false, // TODO
		};
	}
}
