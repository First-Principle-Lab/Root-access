import { cookies } from "next/headers";
import { verifySessionToken } from "./auth";

/** The signed-in admin for a server component or layout, or null. */
export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get("auth-token")?.value);
}
