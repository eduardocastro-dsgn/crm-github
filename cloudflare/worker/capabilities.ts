import type { Env } from "./env";

export type Capabilities = {
	passwordReset: boolean;
	telemetry: boolean;
	mediaStorage: boolean;
};

export function capabilities(env: Env): Capabilities {
	return {
		passwordReset: isSet(env.RESEND_API_KEY) && isSet(env.RESEND_FROM),
		telemetry: isSet(env.POSTHOG_KEY),
		mediaStorage: env.MEDIA !== undefined,
	};
}

function isSet(value: string | undefined): boolean {
	return typeof value === "string" && value.trim() !== "";
}
