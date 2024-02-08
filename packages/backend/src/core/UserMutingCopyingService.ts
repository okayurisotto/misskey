import { Injectable } from '@nestjs/common';
import type { ThinUser } from '@/queue/types.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class UserMutingCopyingService {
	constructor(
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {}

	public async copy(src: ThinUser, dst: ThinUser): Promise<void> {
		const dstMutings = await this.prismaService.client.userMuting.findMany({
			where: { muteeId: dst.id, expiresAt: null },
		});

		const srcMutings = await this.prismaService.client.userMuting.findMany({
			where: {
				muteeId: src.id,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
				muterId: { notIn: dstMutings.map(({ muterId }) => muterId) }, // skip
			},
		});
		if (srcMutings.length === 0) return;

		const newMutings = new Map<
			string,
			Omit<Prisma.UserMutingCreateManyInput, 'id'>
		>();

		// 重複しないようにIDを生成
		const genId = (): string => {
			let id: string;
			do {
				id = this.idService.genId();
			} while (newMutings.has(id));
			return id;
		};

		for (const muting of srcMutings) {
			newMutings.set(genId(), {
				...muting,
				createdAt: new Date(),
				muteeId: dst.id,
			});
		}

		const arrayToCreateMany: Prisma.UserMutingCreateManyInput[] = [
			...newMutings,
		].map((entry) => ({ ...entry[1], id: entry[0] }));
		await this.prismaService.client.userMuting.createMany({
			data: arrayToCreateMany,
		});
	}
}
