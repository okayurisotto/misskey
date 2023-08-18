import { FederationInstanceSchema } from './FederationInstanceSchema.js';

export const FederationInstanceLiteSchema = FederationInstanceSchema.pick({
	name: true,
	softwareName: true,
	softwareVersion: true,
	iconUrl: true,
	faviconUrl: true,
	themeColor: true,
});
