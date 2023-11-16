import os from 'node:os';
import { Injectable } from '@nestjs/common';
import chalk from 'chalk';
import sysUtils from 'systeminformation';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import Logger from '@/misc/logger.js';
import { NODE_ENV, envOption } from '@/env.js';

@Injectable()
export class BootMessageService {
	constructor(private readonly configLoaderService: ConfigLoaderService) {}

	private showLogo(): void {
		const themeColor = chalk.hex('#86b300');

		const v = `v${this.configLoaderService.data.version}`;
		console.log(themeColor('  _____ _         _           '));
		console.log(themeColor(' |     |_|___ ___| |_ ___ _ _ '));
		console.log(themeColor(" | | | | |_ -|_ -| '_| -_| | |"));
		console.log(themeColor(' |_|_|_|_|___|___|_,_|___|_  |'));
		console.log(
			' ' +
				chalk.gray(v) +
				themeColor('                        |___|\n'.substring(v.length)),
		);

		console.log(
			' Misskey is an open-source decentralized microblogging platform.',
		);
		console.log(
			chalk.rgb(
				255,
				136,
				0,
			)(
				' If you like Misskey, please donate to support development. https://www.patreon.com/syuilo',
			),
		);

		console.log('');
		console.log(
			`--- ${os.hostname()} ${chalk.gray(`(PID: ${process.pid})`)} ---`,
		);
	}

	private showGreetingMessage(logger: Logger): void {
		this.configLoaderService.data.version;

		if (!envOption.quiet) this.showLogo();

		logger.info('Welcome to Misskey!');
		logger.info(`Misskey v${this.configLoaderService.data.version}`, true);
	}

	private showEnvironment(parentLogger: Logger): void {
		const logger = parentLogger.createSubLogger('env');

		if (NODE_ENV === undefined) {
			logger.info('NODE_ENV is not set');
		} else {
			logger.info(`NODE_ENV: ${NODE_ENV}`);
		}

		if (NODE_ENV !== 'production') {
			logger.warn('The environment is not in production mode.');
			logger.warn('DO NOT USE FOR PRODUCTION PURPOSE!', true);
		}
	}

	private async showMachineInfo(parentLogger: Logger): Promise<void> {
		const logger = parentLogger.createSubLogger('machine');

		logger.debug(`Hostname: ${os.hostname()}`);
		logger.debug(`Platform: ${process.platform} Arch: ${process.arch}`);

		const mem = await sysUtils.mem();
		const totalmem = (mem.total / 1024 ** 3).toFixed(1);
		const availmem = (mem.available / 1024 ** 3).toFixed(1);

		logger.debug(`CPU: ${os.cpus().length} core`);
		logger.debug(`MEM: ${totalmem}GB (available: ${availmem}GB)`);
	}

	private showNodejsVersion(parentLogger: Logger): void {
		const nodejsLogger = parentLogger.createSubLogger('nodejs');
		nodejsLogger.info(`Version ${process.version} detected.`);
	}

	public async show(logger: Logger): Promise<void> {
		this.showGreetingMessage(logger);
		this.showEnvironment(logger);
		await this.showMachineInfo(logger);
		this.showNodejsVersion(logger);
	}
}
