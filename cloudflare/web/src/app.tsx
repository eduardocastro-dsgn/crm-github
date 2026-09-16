import { Toaster } from "@crm/ui/components/sonner";
import { Navigate, Route, Routes } from "react-router";
import { RequireAuth } from "./components/require-auth";
import { Shell } from "./components/shell";
import { CompaniesPage } from "./routes/companies";
import { ContactsPage } from "./routes/contacts";
import { DealsPage } from "./routes/deals";
import { ForgotPasswordPage } from "./routes/forgot-password";
import { ResetPasswordPage } from "./routes/reset-password";
import { SettingsPage } from "./routes/settings";
import { SignInPage } from "./routes/sign-in";
import { SignUpPage } from "./routes/sign-up";

export function App() {
	return (
		<>
			<Routes>
				<Route path="/sign-in" element={<SignInPage />} />
				<Route path="/sign-up" element={<SignUpPage />} />
				<Route path="/forgot-password" element={<ForgotPasswordPage />} />
				<Route path="/reset-password" element={<ResetPasswordPage />} />

				<Route
					element={
						<RequireAuth>
							<Shell />
						</RequireAuth>
					}
				>
					<Route path="/" element={<Navigate to="/deals" replace />} />
					<Route path="/companies" element={<CompaniesPage />} />
					<Route path="/contacts" element={<ContactsPage />} />
					<Route path="/deals" element={<DealsPage />} />
					<Route path="/settings" element={<SettingsPage />} />
				</Route>

				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>

			<Toaster />
		</>
	);
}
