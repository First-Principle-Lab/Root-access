import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AdminSession {
  userId: string;
  email: string;
}

/** Verifies an `auth-token` value. Signature and expiry only: no database read. */
export function verifySessionToken(token: string | undefined): AdminSession | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      exp: number;
    };

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export async function getServerSession(req: NextRequest) {
  return verifySessionToken(req.cookies.get("auth-token")?.value);
}
