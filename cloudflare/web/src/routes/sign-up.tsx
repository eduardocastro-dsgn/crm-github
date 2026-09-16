import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthCard } from "../components/auth-card";
import { signUp } from "../lib/auth-client";

const MIN_PASSWORD_LENGTH = 12;

export function SignUpPage() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError(null);

		if (password !== confirm) {
			setError("As duas senhas são diferentes.");
			return;
		}

		if (password.length < MIN_PASSWORD_LENGTH) {
			setError(`A senha precisa de ${MIN_PASSWORD_LENGTH} caracteres ou mais.`);
			return;
		}

		setBusy(true);

		const result = await signUp.email({ name, email, password });

		setBusy(false);

		if (result.error) {
			setError(
				result.error.status === 403
					? "Este email não tem permissão para criar conta neste CRM."
					: "Não foi possível criar a conta.",
			);
			return;
		}

		navigate("/", { replace: true });
	}

	return (
		<AuthCard
			title="Criar conta"
			description="Só endereços autorizados pelo administrador entram."
			footer={
				<p className="text-muted-foreground text-sm">
					Já tem conta? <Link to="/sign-in">Entrar</Link>
				</p>
			}
		>
			<form className="flex flex-col gap-6" onSubmit={submit}>
				<div className="flex flex-col gap-2">
					<Label htmlFor="name">Nome</Label>
					<Input
						id="name"
						autoComplete="name"
						required
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>

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
						autoComplete="new-password"
						required
						minLength={MIN_PASSWORD_LENGTH}
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="confirm">Repetir a senha</Label>
					<Input
						id="confirm"
						type="password"
						autoComplete="new-password"
						required
						value={confirm}
						onChange={(event) => setConfirm(event.target.value)}
					/>
				</div>

				{error ? <p className="text-destructive text-sm">{error}</p> : null}

				<Button type="submit" disabled={busy}>
					{busy ? "Criando" : "Criar conta"}
				</Button>
			</form>
		</AuthCard>
	);
}
