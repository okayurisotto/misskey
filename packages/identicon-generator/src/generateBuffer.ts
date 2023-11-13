import { ofetch } from 'ofetch';
import InitCanvasKit from 'canvaskit-wasm';
import randomSeed from 'random-seed';
import { range } from 'range';
import { generateFillData } from './generateFillData.js';
import { backgroundGradientColors } from './colors.js';
import type { CanvasKit } from 'canvaskit-wasm';

// @ts-expect-error
const CanvasKit: Promise<CanvasKit> = InitCanvasKit();

/**
 * IdenticonのArrayBufferを生成する。
 */
export const generateBuffer = async (
	seed: string,
	options: { resolution: number; cellSize: number; imageSize: number },
): Promise<ArrayBuffer> => {
	/** 実際に描かれる範囲のピクセル数 */
	const actualSize = options.resolution * options.cellSize;

	/** 描く範囲の外側に取る余白のピクセル数 */
	const margin = (options.imageSize - actualSize) / 2;

	const rand = randomSeed.create(seed);
	const data = generateFillData(seed, { resolution: options.resolution });

	const canvas = (await CanvasKit).MakeCanvas(
		options.imageSize,
		options.imageSize,
	);
	const ctx = canvas.getContext('2d');

	// 背景を描画
	const bg = ctx.createLinearGradient(
		0,
		0,
		options.imageSize,
		options.imageSize,
	);
	const bgColors =
		backgroundGradientColors[rand(backgroundGradientColors.length)]!;
	bg.addColorStop(0, bgColors[0]);
	bg.addColorStop(1, bgColors[1]);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, options.imageSize, options.imageSize);

	ctx.fillStyle = '#ffffff';

	for (const x of range({ stop: options.resolution })) {
		for (const y of range({ stop: options.resolution })) {
			const i = x + y * options.resolution;
			const bit = (data >> i) & 1;

			if (bit === 0) continue;
			if (bit === 1) {
				const actualX = margin + options.cellSize * x;
				const actualY = margin + options.cellSize * y;
				ctx.fillRect(actualX, actualY, options.cellSize, options.cellSize);
			}
		}
	}

	const response = ofetch(canvas.toDataURL());
	const buffer = await response.then((res) => res.arrayBuffer());
	return buffer;
};
