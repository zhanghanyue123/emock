import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import type { AppUser, AuthResult, SignInInput, SignUpInput } from "@/types/billing";
import { updateDevDatabase, readDevDatabase } from "./dev-database";

export const AUTH_COOKIE = "exam_session";

export interface AuthAdapter {
  getCurrentUser(): Promise<AppUser | null>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function setSessionCookie(sessionId: string) {
  (await cookies()).set(AUTH_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export class DevAuthAdapter implements AuthAdapter {
  async getCurrentUser() {
    const sessionId = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!sessionId) return null;
    const db = await readDevDatabase();
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) return null;
    return db.users.find((user) => user.id === session.userId) || null;
  }

  async signUp(input: SignUpInput) {
    const email = normalizeEmail(input.email);
    if (!email.includes("@")) throw new Error("A valid email is required.");
    return updateDevDatabase(async (db) => {
      const now = new Date().toISOString();
      let user = db.users.find((item) => item.email === email);
      if (!user) {
        user = { id: crypto.randomUUID(), email, displayName: input.displayName, role: "student", createdAt: now, updatedAt: now };
        db.users.push(user);
        db.entitlements.push({ userId: user.id, planId: "free", status: "active", startsAt: now, source: "free" });
      }
      const session = { id: crypto.randomUUID(), userId: user.id, createdAt: now };
      db.sessions.push(session);
      await setSessionCookie(session.id);
      return { user, sessionId: session.id };
    });
  }

  async signIn(input: SignInInput) {
    const email = normalizeEmail(input.email);
    return updateDevDatabase(async (db) => {
      const user = db.users.find((item) => item.email === email);
      if (!user) throw new Error("No test account exists for this email.");
      const session = { id: crypto.randomUUID(), userId: user.id, createdAt: new Date().toISOString() };
      db.sessions.push(session);
      await setSessionCookie(session.id);
      return { user, sessionId: session.id };
    });
  }

  async signOut() {
    const jar = await cookies();
    const sessionId = jar.get(AUTH_COOKIE)?.value;
    if (sessionId) {
      await updateDevDatabase((db) => {
        db.sessions = db.sessions.filter((session) => session.id !== sessionId);
      });
    }
    jar.delete(AUTH_COOKIE);
  }

  async requestPasswordReset() {
    return;
  }
}

export const authAdapter = new DevAuthAdapter();
