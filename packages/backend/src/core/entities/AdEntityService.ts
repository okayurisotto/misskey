import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { AdSchema } from '@/models/zod/AdSchema.js';
import type { ad } from '@prisma/client';

@Injectable()
export class AdEntityService {
	public pack(ad: ad): z.infer<typeof AdSchema> {
		return {
			...ad,
			expiresAt: +ad.expiresAt,
			startsAt: +ad.startsAt,
		};
	}
}
