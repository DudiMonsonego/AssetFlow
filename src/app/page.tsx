import { redirect } from "next/navigation";

/**
 * Root route — redirect authenticated users to the dashboard,
 * unauthenticated users are handled by the middleware → /login.
 */
export default function RootPage() {
  redirect("/dashboard");
}
