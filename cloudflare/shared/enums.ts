import { z } from "zod";

export const DEAL_STAGES = [
	"DEMO_BOOKED",
	"QUALIFIED_TO_BUY",
	"UNQUALIFIED_TO_BUY",
	"DECISION_MAKER_BOUGHT_IN",
	"CONTRACT_SENT",
	"CLOSED_WON",
	"CLOSED_LOST",
] as const;

export const dealStage = z.enum(DEAL_STAGES);
export type DealStage = z.infer<typeof dealStage>;

export const OPEN_STAGES = DEAL_STAGES.filter(
	(stage) => stage !== "CLOSED_WON" && stage !== "CLOSED_LOST",
);

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
	DEMO_BOOKED: "Demo agendada",
	QUALIFIED_TO_BUY: "Qualificado",
	UNQUALIFIED_TO_BUY: "Desqualificado",
	DECISION_MAKER_BOUGHT_IN: "Decisor convencido",
	CONTRACT_SENT: "Contrato enviado",
	CLOSED_WON: "Ganho",
	CLOSED_LOST: "Perdido",
};

export const ACTIVITY_TYPES = [
	"NOTE",
	"CALL",
	"EMAIL",
	"MEETING",
	"TASK",
	"STAGE_CHANGE",
] as const;

export const activityType = z.enum(ACTIVITY_TYPES);
export type ActivityType = z.infer<typeof activityType>;

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
	NOTE: "Nota",
	CALL: "Ligação",
	EMAIL: "Email",
	MEETING: "Reunião",
	TASK: "Tarefa",
	STAGE_CHANGE: "Mudança de etapa",
};

export const RECORD_SOURCES = ["MANUAL", "IMPORT"] as const;
export const recordSource = z.enum(RECORD_SOURCES);
export type RecordSource = z.infer<typeof recordSource>;

export const FIELD_ENTITIES = ["COMPANY", "CONTACT", "DEAL"] as const;
export const fieldEntity = z.enum(FIELD_ENTITIES);
export type FieldEntity = z.infer<typeof fieldEntity>;

export const FIELD_TYPES = [
	"TEXT",
	"LONG_TEXT",
	"NUMBER",
	"DATE",
	"CHECKBOX",
	"SELECT",
	"URL",
	"EMAIL",
	"PHONE",
	"USER",
] as const;

export const fieldType = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof fieldType>;

export const RATE_SOURCES = ["FETCHED", "MANUAL"] as const;
export const rateSource = z.enum(RATE_SOURCES);
export type RateSource = z.infer<typeof rateSource>;

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export const workspaceRole = z.enum(WORKSPACE_ROLES);
export type WorkspaceRole = z.infer<typeof workspaceRole>;
