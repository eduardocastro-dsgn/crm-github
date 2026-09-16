import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthCard } from "../components/auth-card";
import { signIn } from "../lib/auth-client";

const GENERIC_FAILURE = "Email ou senha incorretos.";

export function SignInPage() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);

		const result = await signIn.email({ email, password });

		setBusy(false);

		if (result.error) {
			setError(GENERIC_FAILURE);
			return;
		}

		navigate("/", { replace: true });
	}

	return (
		<AuthCard
			title="Entrar"
			description="Use o email e a senha da sua conta."
			footer={
				<p className="text-muted-foreground text-sm">
					Não tem conta? <Link to="/sign-up">Criar conta</Link>
				</p>
			}
		>
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

				<div className="flex flex-col gap-2">
					<Label htmlFor="password">Senha</Label>
					<Input
						id="password"
						type="password"
						autoComplete="current-password"
						required
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
					<Link to="/forgot-password" className="text-sm">
						Esqueci a senha
					</Link>
				</div>

				{error ? <p className="text-destructive text-sm">{error}</p> : null}

				<Button type="submit" disabled={busy}>
					{busy ? "Entrando" : "Entrar"}
				</Button>
			</form>
		</AuthCard>
	);
}
