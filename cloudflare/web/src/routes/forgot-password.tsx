import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { AuthCard } from "../components/auth-card";
import { authClient } from "../lib/auth-client";

const SAME_ANSWER =
	"Se este endereço tem conta, o link de redefinição chega em instantes.";

export function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);

		await authClient.requestPasswordReset({
			email,
			redirectTo: "/reset-password",
		});

		setBusy(false);
		setSent(true);
	}

	return (
		<AuthCard
			title="Esqueci a senha"
			description="Informe o email da sua conta."
			footer={
				<p className="text-muted-foreground text-sm">
					<Link to="/sign-in">Voltar para entrar</Link>
				</p>
			}
		>
			{sent ? (
				<p className="text-sm">{SAME_ANSWER}</p>
			) : (
				<form className="flex flex-col gap-6" onSubmit={submit}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>

					<Button type="submit" disabled={busy}>
						{busy ? "Enviando" : "Enviar link"}
					</Button>
				</form>
			)}
		</AuthCard>
	);
}
