import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RoleCondFormulaValueSchema } from '@/models/zod/RoleCondFormulaSchema.js';
import { UserPoliciesSchema } from '@/models/zod/RolePoliciesSchema.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { User } from '@prisma/client';

export type RolePolicies = Required<z.infer<typeof UserPoliciesSchema>>;

@Injectable()
export class RoleConditionEvalService {
	public static AlreadyAssignedError = class extends Error {};
	public static NotAssignedError = class extends Error {};

	constructor(private readonly userEntityUtilService: UserEntityUtilService) {}

	public eval(
		user: User,
		value: z.infer<typeof RoleCondFormulaValueSchema>,
	): boolean {
		try {
			switch (value.type) {
				case 'and': {
					return value.values.every((v) => this.eval(user, v));
				}
				case 'or': {
					return value.values.some((v) => this.eval(user, v));
				}
				case 'not': {
					return !this.eval(user, value.value);
				}
				case 'isLocal': {
					return this.userEntityUtilService.isLocalUser(user);
				}
				case 'isRemote': {
					return this.userEntityUtilService.isRemoteUser(user);
				}
				case 'createdLessThan': {
					return user.createdAt.getTime() > Date.now() - value.sec * 1000;
				}
				case 'createdMoreThan': {
					return user.createdAt.getTime() < Date.now() - value.sec * 1000;
				}
				case 'followersLessThanOrEq': {
					return user.followersCount <= value.value;
				}
				case 'followersMoreThanOrEq': {
					return user.followersCount >= value.value;
				}
				case 'followingLessThanOrEq': {
					return user.followingCount <= value.value;
				}
				case 'followingMoreThanOrEq': {
					return user.followingCount >= value.value;
				}
				case 'notesLessThanOrEq': {
					return user.notesCount <= value.value;
				}
				case 'notesMoreThanOrEq': {
					return user.notesCount >= value.value;
				}
				default:
					return false;
			}
		} catch (err) {
			// TODO: log error
			return false;
		}
	}
}
