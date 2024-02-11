import { Injectable } from '@nestjs/common';
import si from 'systeminformation';
import Xev from 'xev';
import * as osUtils from 'os-utils';
import { MetaService } from '@/core/MetaService.js';
import type { OnApplicationShutdown } from '@nestjs/common';

const ev = new Xev();

const INTERVAL = 2000;

const roundCpu = (num: number): number => Math.round(num * 1000) / 1000;
const round = (num: number): number => Math.round(num * 10) / 10;

// CPU STAT
function cpuUsage(): Promise<number> {
	return new Promise((resolve) => {
		osUtils.cpuUsage((cpuUsage) => {
			resolve(cpuUsage);
		});
	});
}

// MEMORY STAT
async function mem(): Promise<si.Systeminformation.MemData> {
	const data = await si.mem();
	return data;
}

// NETWORK STAT
async function net(): Promise<si.Systeminformation.NetworkStatsData> {
	const iface = await si.networkInterfaceDefault();
	const data = await si.networkStats(iface);
	return data[0];
}

// FS STAT
async function fs(): Promise<
	si.Systeminformation.DisksIoData | { rIO_sec: number; wIO_sec: number }
> {
	const data = await si.disksIO().catch(() => ({ rIO_sec: 0, wIO_sec: 0 }));
	return data ?? { rIO_sec: 0, wIO_sec: 0 };
}

@Injectable()
export class ServerStatsService implements OnApplicationShutdown {
	private intervalId: NodeJS.Timer | null = null;

	constructor(private readonly metaService: MetaService) {}

	/**
	 * Report server stats regularly
	 */
	public async start(): Promise<void> {
		const meta = await this.metaService.fetch();
		if (!meta.enableServerMachineStats) return;

		const log: unknown[] = [];

		ev.on('requestServerStatsLog', (x) => {
			ev.emit(`serverStatsLog:${x.id}`, log.slice(0, x.length ?? 50));
		});

		const tick = async (): Promise<void> => {
			const [cpu, memStats, netStats, fsStats] = await Promise.all([
				cpuUsage(),
				mem(),
				net(),
				fs(),
			]);

			const stats = {
				cpu: roundCpu(cpu),
				mem: {
					used: round(memStats.total - memStats.available),
					active: round(memStats.active),
				},
				net: {
					rx: round(Math.max(0, netStats.rx_sec)),
					tx: round(Math.max(0, netStats.tx_sec)),
				},
				fs: {
					r: round(Math.max(0, fsStats.rIO_sec ?? 0)),
					w: round(Math.max(0, fsStats.wIO_sec ?? 0)),
				},
			};

			ev.emit('serverStats', stats);
			log.unshift(stats);

			if (log.length > 200) log.pop();
		};

		await tick();

		this.intervalId = setInterval(async () => {
			await tick();
		}, INTERVAL);
	}

	public onApplicationShutdown(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
		}
	}
}
