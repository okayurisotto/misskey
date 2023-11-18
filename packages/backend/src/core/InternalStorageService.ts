import * as fs from 'node:fs';
import * as Path from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import { INTERNAL_STORAGE_DIR } from '@/paths.js';

@Injectable()
export class InternalStorageService {
	constructor(private readonly configLoaderService: ConfigLoaderService) {}

	public resolvePath(key: string): string {
		return Path.resolve(INTERNAL_STORAGE_DIR, key);
	}

	public read(key: string): fs.ReadStream {
		return fs.createReadStream(this.resolvePath(key));
	}

	public saveFromPath(key: string, srcPath: string): string {
		fs.mkdirSync(INTERNAL_STORAGE_DIR, { recursive: true });
		fs.copyFileSync(srcPath, this.resolvePath(key));
		return `${this.configLoaderService.data.url}/files/${key}`;
	}

	public saveFromBuffer(key: string, data: Buffer): string {
		fs.mkdirSync(INTERNAL_STORAGE_DIR, { recursive: true });
		fs.writeFileSync(this.resolvePath(key), data);
		return `${this.configLoaderService.data.url}/files/${key}`;
	}

	public del(key: string): void {
		fs.unlink(this.resolvePath(key), () => {});
	}
}
