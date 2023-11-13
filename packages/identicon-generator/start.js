import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { BufferGenerator } from './built/BufferGenerator.js';

const bufferGenerator = new BufferGenerator(1000, {
	cellSize: 16,
	imageSize: 64 * 3,
	resolution: 5,
});

const app = new Hono();

app.get('/identicon/:seed', async (context) => {
	const buffer = await bufferGenerator.compute(context.req.param('seed'));
	return context.newResponse(buffer, 200, { 'Content-Type': 'image/png' });
});

serve({ fetch: app.fetch, port: 3456 }, ({ address, port }) => {
	console.log(`http://${address}:${port}/identicon/:seed`);
});
