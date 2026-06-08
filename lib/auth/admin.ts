import { createClient as createServerSupabase } from "@/lib/supabase/server";

export async function requireAdminUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return null;
  }

  return user;
}
