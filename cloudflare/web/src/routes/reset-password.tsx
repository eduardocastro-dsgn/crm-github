import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthCard } from "../components/auth-card";
import { authClient } from "../lib/auth-client";

const MIN_PASSWORD_LENGTH = 12;

export function ResetPasswordPage() {
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const token = params.get("token");

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

		if (!token) {
			setError("O link é inválido ou já expirou.");
			return;
		}

		setBusy(true);

		const result = await authClient.resetPassword({ newPassword: password, token });

		setBusy(false);

		if (result.error) {
			setError("O link é inválido ou já expirou.");
			return;
		}

		navigate("/sign-in", { replace: true });
	}

	return (
		<AuthCard
			title="Nova senha"
			description={`Escolha uma senha de ${MIN_PASSWORD_LENGTH} caracteres ou mais.`}
			footer={
				<p className="text-muted-foreground text-sm">
					<Link to="/sign-in">Voltar para entrar</Link>
				</p>
			}
		>
			<form className="flex flex-col gap-6" onSubmit={submit}>
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
					{busy ? "Salvando" : "Salvar senha"}
				</Button>
			</form>
		</AuthCard>
	);
}
