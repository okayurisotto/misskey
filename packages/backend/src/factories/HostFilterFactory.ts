import { Injectable } from '@nestjs/common';
import { HostFilterEntity } from '@/entities/HostFilterEntity.js';

@Injectable()
export class HostFilterFactory {
	public create(value: string): HostFilterEntity {
		return new HostFilterEntity(value);
	}
}
