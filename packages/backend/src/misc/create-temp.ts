import * as tmp from 'tmp';
import { NODE_ENV } from '@/env.js';

export function createTemp(): Promise<[string, () => void]> {
	return new Promise<[string, () => void]>((res, rej) => {
		tmp.file((e, path, fd, cleanup) => {
			if (e) return rej(e);
			res([path, NODE_ENV === 'production' ? cleanup : (): void => {}]);
		});
	});
}

export function createTempDir(): Promise<[string, () => void]> {
	return new Promise<[string, () => void]>((res, rej) => {
		tmp.dir(
			{
				unsafeCleanup: true,
			},
			(e, path, cleanup) => {
				if (e) return rej(e);
				res([path, NODE_ENV === 'production' ? cleanup : (): void => {}]);
			},
		);
	});
}
