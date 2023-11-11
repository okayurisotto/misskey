import type { components } from './api.types.js';

export type ID = string;
export type DateString = string;

type TODO = Record<string, any>;

// NOTE: 極力この型を使うのは避け、UserLite か UserDetailed か明示するように
export type User = UserLite | UserDetailed;

export type UserLite = components['schemas']['UserLite'];

export type UserDetailed = components['schemas']['UserDetailed'];

export type UserGroup = TODO;

export type UserList = components['schemas']['UserList'];

export type MeDetailed = components['schemas']['MeDetailed'];

export type MeDetailedWithSecret = MeDetailed & {
	email: string;
	emailVerified: boolean;
	securityKeysList: {
		id: string;
		name: string;
		lastUsed: string;
	}[];
};

export type MeSignup = MeDetailedWithSecret & {
	token: string;
};

export type DriveFile = components['schemas']['DriveFile'];

export type DriveFolder = components['schemas']['DriveFolder'];

export type GalleryPost = components['schemas']['GalleryPost'];

export type Note = components['schemas']['Note'];

export type NoteReaction = components['schemas']['NoteReaction'];

export type Notification = components['schemas']['Notification'];

export type MessagingMessage = {
	id: ID;
	createdAt: DateString;
	file: DriveFile | null;
	fileId: DriveFile['id'] | null;
	isRead: boolean;
	reads: User['id'][];
	text: string | null;
	user: User;
	userId: User['id'];
	recipient?: User | null;
	recipientId: User['id'] | null;
	group?: UserGroup | null;
	groupId: UserGroup['id'] | null;
};

export type CustomEmoji = {
	id: string;
	name: string;
	url: string;
	category: string;
	aliases: string[];
};

export type LiteInstanceMetadata = {
	maintainerName: string | null;
	maintainerEmail: string | null;
	version: string;
	name: string | null;
	uri: string;
	description: string | null;
	langs: string[];
	tosUrl: string | null;
	repositoryUrl: string;
	feedbackUrl: string;
	disableRegistration: boolean;
	disableLocalTimeline: boolean;
	disableGlobalTimeline: boolean;
	driveCapacityPerLocalUserMb: number;
	driveCapacityPerRemoteUserMb: number;
	emailRequiredForSignup: boolean;
	enableHcaptcha: boolean;
	hcaptchaSiteKey: string | null;
	enableRecaptcha: boolean;
	recaptchaSiteKey: string | null;
	enableTurnstile: boolean;
	turnstileSiteKey: string | null;
	swPublickey: string | null;
	themeColor: string | null;
	mascotImageUrl: string | null;
	bannerUrl: string | null;
	serverErrorImageUrl: string | null;
	infoImageUrl: string | null;
	notFoundImageUrl: string | null;
	iconUrl: string | null;
	backgroundImageUrl: string | null;
	logoImageUrl: string | null;
	maxNoteTextLength: number;
	enableEmail: boolean;
	enableTwitterIntegration: boolean;
	enableGithubIntegration: boolean;
	enableDiscordIntegration: boolean;
	enableServiceWorker: boolean;
	emojis: CustomEmoji[];
	defaultDarkTheme: string | null;
	defaultLightTheme: string | null;
	ads: {
		id: ID;
		ratio: number;
		place: string;
		url: string;
		imageUrl: string;
	}[];
	translatorAvailable: boolean;
	serverRules: string[];
};

export type DetailedInstanceMetadata = LiteInstanceMetadata & {
	pinnedPages: string[];
	pinnedClipId: string | null;
	cacheRemoteFiles: boolean;
	cacheRemoteSensitiveFiles: boolean;
	requireSetup: boolean;
	proxyAccountName: string | null;
	features: Record<string, any>;
};

export type InstanceMetadata = LiteInstanceMetadata | DetailedInstanceMetadata;

export type ServerInfo = {
	machine: string;
	cpu: {
		model: string;
		cores: number;
	};
	mem: {
		total: number;
	};
	fs: {
		total: number;
		used: number;
	};
};

export type Stats = {
	notesCount: number;
	originalNotesCount: number;
	usersCount: number;
	originalUsersCount: number;
	instances: number;
	driveUsageLocal: number;
	driveUsageRemote: number;
};

export type Page = components['schemas']['Page'];

export type PageEvent = {
	pageId: Page['id'];
	event: string;
	var: any;
	userId: User['id'];
	user: User;
};

export type Announcement = {
	id: ID;
	createdAt: DateString;
	updatedAt: DateString | null;
	text: string;
	title: string;
	imageUrl: string | null;
	isRead?: boolean;
};

export type Antenna = components['schemas']['Antenna'];

export type App = components['schemas']['App'];

export type AuthSession = {
	id: ID;
	app: App;
	token: string;
};

export type Ad = TODO;

export type Clip = components['schemas']['Clip'];

export type NoteFavorite = components['schemas']['NoteFavorite'];

export type FollowRequest = {
	id: ID;
	follower: User;
	followee: User;
};

export type Channel = components['schemas']['Channel'];

export type Following = components['schemas']['Following'];

export type FollowingFolloweePopulated = Following;

export type FollowingFollowerPopulated = Following;

export type Blocking = components['schemas']['Blocking'];

export type Instance = components['schemas']['FederationInstance'];

export type Signin = {
	id: ID;
	createdAt: DateString;
	ip: string;
	headers: Record<string, any>;
	success: boolean;
};

export type Invite = components['schemas']['InviteCode'];

export type InviteLimit = {
	remaining: number;
};

export type UserSorting =
	| '+follower'
	| '-follower'
	| '+createdAt'
	| '-createdAt'
	| '+updatedAt'
	| '-updatedAt';

export type OriginType = 'combined' | 'local' | 'remote';
