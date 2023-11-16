import { Module } from '@nestjs/common';
import { CoreModule } from '@/core/CoreModule.js';
import { JanitorService } from './JanitorService.js';
import { QueueStatsService } from './QueueStatsService.js';
import { ServerStatsService } from './ServerStatsService.js';

@Module({
	imports: [CoreModule],
	providers: [JanitorService, QueueStatsService, ServerStatsService],
	exports: [JanitorService, QueueStatsService, ServerStatsService],
})
export class DaemonModule {}
