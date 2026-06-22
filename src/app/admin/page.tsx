import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLogin } from "@/components/admin-login";
import { hasAdminAccess } from "@/lib/server/require-admin";
import { listBookingRequests, listRooms, listTags } from "@/lib/server/repository";
import { hasSupabaseConfiguration } from "@/lib/server/supabase";

export default async function AdminPage() {
  if (!(await hasAdminAccess())) {
    return <main className="admin-login-shell"><AdminLogin /></main>;
  }
  if (!hasSupabaseConfiguration()) {
    return <main className="admin-login-shell"><section className="admin-login"><h1>Connect Supabase to open the dashboard.</h1><p>Add the Supabase environment variables, apply the migration, then seed the catalogue.</p></section></main>;
  }
  const [requests, rooms, tags] = await Promise.all([listBookingRequests(), listRooms(), listTags()]);
  return <AdminDashboard initialRequests={requests} initialRooms={rooms} initialTags={tags} />;
}
