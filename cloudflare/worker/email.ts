import { capabilities } from "./capabilities";
import type { Env } from "./env";

export type Mail = {
	to: string;
	subject: string;
	text: string;
};

export async function sendMail(env: Env, mail: Mail): Promise<boolean> {
	if (!capabilities(env).passwordReset) return false;

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.RESEND_API_KEY}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			from: env.RESEND_FROM,
			to: [mail.to],
			subject: mail.subject,
			text: mail.text,
		}),
	});

	if (!response.ok) {
		console.log({
			message: "Envio de email falhou",
			status: response.status,
		});
		return false;
	}

	return true;
}
