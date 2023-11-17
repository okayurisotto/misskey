// @ts-check

import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm';
import { GlobalModule } from './built/GlobalModule.js';
import { ConfigLoaderService } from './built/ConfigLoaderService.js';
import { entities } from './built/core/TypeORMService.js';

export default (async () => {
	const app = await NestFactory.createApplicationContext(GlobalModule);
	const configLoaderService = await app.resolve(ConfigLoaderService);

	return new DataSource({
		type: 'postgres',
		host: configLoaderService.data.db.host,
		port: configLoaderService.data.db.port,
		username: configLoaderService.data.db.user,
		password: configLoaderService.data.db.pass,
		database: configLoaderService.data.db.db,
		entities: entities,
		migrations: ['migration/*.js'],
	});
})();
