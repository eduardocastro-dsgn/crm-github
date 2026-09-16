import { Spinner } from "@crm/ui/components/spinner";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useSession } from "../lib/auth-client";

export function RequireAuth({ children }: { children: ReactNode }) {
	const { data, isPending } = useSession();
	const location = useLocation();

	if (isPending) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (!data) {
		return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
	}

	return <>{children}</>;
}
