import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '@/core/PrismaService.js';
import type { UserPoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';
import type { Meta } from '@prisma/client';

@Injectable()
export class MetaService {
	private readonly DEFAULT_ID = 'x';

	constructor(private readonly prismaService: PrismaService) {}

	public async fetch(): Promise<Meta> {
		return await this.prismaService.client.$transaction(async (prisma) => {
			const meta = await prisma.meta.findFirst({ orderBy: { id: 'desc' } });
			if (meta !== null) return meta;

			return await prisma.meta.create({ data: { id: this.DEFAULT_ID } });
		});
	}

	public async update(
		data: Partial<
			Omit<Meta, 'id'> & { policies?: z.infer<typeof UserPoliciesSchema> }
		>,
	): Promise<void> {
		await this.prismaService.client.$transaction(async (prisma) => {
			const meta = await prisma.meta.findFirst({ orderBy: { id: 'desc' } });

			if (meta === null) {
				await prisma.meta.create({ data: { id: this.DEFAULT_ID, ...data } });
			} else {
				await prisma.meta.update({ where: { id: meta.id }, data });
			}
		});
	}
}
