import Stream, { Connection } from './streaming.js';
import * as Acct from './acct.js';
import * as consts from './consts.js';
import * as api from './api.js';
import * as entities from './entities.js';
import type { Channels } from './streaming.types.js';
import type { Endpoints } from './wrapper.js';

export { api, entities };

export {
	type Endpoints,
	Stream,
	Connection as ChannelConnection,
	type Channels,
	Acct,
};

export const permissions = consts.permissions;
export const notificationTypes = consts.notificationTypes;
export const noteVisibilities = consts.noteVisibilities;
export const mutedNoteReasons = consts.mutedNoteReasons;
export const ffVisibility = consts.ffVisibility;
