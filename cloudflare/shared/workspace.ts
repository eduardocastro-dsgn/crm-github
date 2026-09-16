export const WORKSPACE_ID = "workspace";

export const DEFAULT_WORKSPACE_NAME = "CRM";

export const DEFAULT_WORKSPACE_SLUG = "workspace";

export const MAX_SLUG = 48;

export const RESERVED_SLUGS: readonly string[] = [
	"api",
	"assets",
	"companies",
	"contacts",
	"deals",
	"forgot-password",
	"reset-password",
	"settings",
	"sign-in",
	"sign-up",
	"workspace",
];

export function workspaceSlug(name: string): string {
	const base = name
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.slice(0, MAX_SLUG)
		.replace(/^-+|-+$/g, "");

	if (!base) return DEFAULT_WORKSPACE_SLUG;

	return RESERVED_SLUGS.includes(base) ? `${base}-crm` : base;
}

export function isWorkspaceEmail(
	email: string,
	allowList: readonly string[],
): boolean {
	if (allowList.length === 0) return false;

	const address = email.trim().toLowerCase();
	const at = address.lastIndexOf("@");
	if (at < 1) return false;

	const domain = address.slice(at + 1);

	return allowList.some((entry) => {
		const allowed = entry.trim().toLowerCase();
		if (allowed === "") return false;
		return allowed.includes("@") ? allowed === address : allowed === domain;
	});
}

export function parseAllowList(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry !== "");
}
