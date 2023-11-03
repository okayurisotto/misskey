import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import chalk from 'chalk';
import chalkTemplate from 'chalk-template';
import Logger from '@/logger.js';
import { envOption } from '@/env.js';

export const showGreetingMessage = (logger: Logger): void => {
	const _filename = fileURLToPath(import.meta.url);
	const _dirname = dirname(_filename);

	const metaPath = `${_dirname}/../../../../built/meta.json`;
	const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

	const themeColor = chalk.hex('#86b300');

	if (!envOption.quiet) {
		//#region Misskey logo
		const v = `v${meta.version}`;
		console.log(themeColor('  _____ _         _           '));
		console.log(themeColor(' |     |_|___ ___| |_ ___ _ _ '));
		console.log(themeColor(" | | | | |_ -|_ -| '_| -_| | |"));
		console.log(themeColor(' |_|_|_|_|___|___|_,_|___|_  |'));
		console.log(
			' ' +
				chalk.gray(v) +
				themeColor('                        |___|\n'.substring(v.length)),
		);
		//#endregion
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
			chalkTemplate`--- ${os.hostname()} {gray (PID: ${process.pid.toString()})} ---`,
		);
	}

	logger.info('Welcome to Misskey!');
	logger.info(`Misskey v${meta.version}`, null, true);
};
