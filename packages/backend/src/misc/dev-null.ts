import { Writable, WritableOptions } from 'node:stream';

export class DevNull extends Writable implements NodeJS.WritableStream {
	constructor(opts?: WritableOptions) {
		super(opts);
	}

	override _write(chunk: any, encoding: BufferEncoding, cb: (err?: Error | null) => void): void {
		setImmediate(cb);
	}
}
