/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Test } from '@nestjs/testing';
import { beforeAll, expect, test, describe, afterEach } from '@jest/globals';
import { DataSource } from 'typeorm';
import { AdSchema } from '@/models/zod/AdSchema.js';
import { GlobalModule } from '@/GlobalModule.js';
import { CoreModule } from '@/core/CoreModule.js';
import { resetDb } from '@/misc/reset-db.js';
import { DI } from '@/di-symbols.js';
import { AdEntityService } from './AdEntityService.js';
import { initTestDb } from '@/../test/utils.js';

let adEntityService: AdEntityService;
let db: DataSource;

describe('CRUD', () => {
	beforeAll(async () => {
		process.env['NODE_ENV'] = 'test';

		const moduleRef = await Test.createTestingModule({
			imports: [GlobalModule, CoreModule],
		}).compile();
		moduleRef.enableShutdownHooks();

		db = moduleRef.get<DataSource>(DI.db);
		adEntityService = moduleRef.get(AdEntityService);

		await initTestDb();
	});

	afterEach(async () => {
		await resetDb(db);
	});

	const data = {
		expiresAt: new Date(),
		imageUrl: 'https://www.example.com/image.png',
		memo: '',
		place: '',
		priority: '',
		url: 'https://www.example.com/',
	};
	const diff = {
		memo: 'updated',
	};

	test('CREATE', async () => {
		const cResult = await adEntityService.create(data);

		expect(AdSchema.strict().safeParse(cResult).success).toBe(true);
	});

	test('READ', async () => {
		const cResult = await adEntityService.create(data);
		const rResult = await adEntityService.showMany({});

		expect(rResult).toStrictEqual([cResult]);
	});

	test('UPDATE', async () => {
		const cResult = await adEntityService.create(data);
		const rResult_1 = await adEntityService.showMany({});
		await adEntityService.update({ id: cResult.id }, diff);
		const rResult_2 = await adEntityService.showMany({});

		expect(rResult_2).not.toStrictEqual(rResult_1);
		expect(rResult_2.map((v) => v.memo)).toStrictEqual([diff.memo]);
	});

	test('DELETE', async () => {
		const cResult = await adEntityService.create(data);
		await adEntityService.delete({ id: cResult.id });
		const rResult = await adEntityService.showMany({});

		expect(rResult).toStrictEqual([]);
	});
});
