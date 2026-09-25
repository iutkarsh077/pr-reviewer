import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAuthSession, deleteAuthSession, getAuthSession, getGithubUser } from "@/lib/database";

export const sessionCookieName = "pr_reviewer_session";
export const oauthStateCookieName = "github_oauth_state";
export const sessionLifetimeSeconds = 60 * 60 * 24 * 30;

function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken() {
    return randomBytes(32).toString("hex");
}

export function secureCookieOptions(maxAge: number) {
    return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge, path: "/" };
}

export async function createSession(userId: string) {
    const token = createOpaqueToken();
    await createAuthSession(userId, hashToken(token), new Date(Date.now() + sessionLifetimeSeconds * 1000));
    return token;
}

export async function getCurrentUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get(sessionCookieName)?.value;
    if (!token) return null;
    const session = await getAuthSession(hashToken(token));
    if (!session) return null;
    return getGithubUser(session.userId);
}

export async function deleteCurrentSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(sessionCookieName)?.value;
    if (token) await deleteAuthSession(hashToken(token));
}