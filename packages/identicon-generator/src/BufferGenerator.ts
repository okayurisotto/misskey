import { Memoize } from 'memoize';
import { generateBuffer } from './generateBuffer.js';

/**
 * `generateBuffer`をメモ化したもの
 */
export class BufferGenerator extends Memoize<string, Promise<ArrayBuffer>> {
	constructor(
		limit: number,
		private readonly options: {
			resolution: number;
			cellSize: number;
			imageSize: number;
		},
	) {
		super(limit);
	}

	protected override serialize(seed: string): string {
		return seed;
	}

	protected override execute(seed: string): Promise<ArrayBuffer> {
		return generateBuffer(seed, this.options);
	}
}
