import { NextResponse } from "next/server";
import { deleteCurrentSession, secureCookieOptions, sessionCookieName } from "@/lib/auth";

export async function POST() {
    await deleteCurrentSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName, "", secureCookieOptions(0));
    response.cookies.set("github_installation_id", "", secureCookieOptions(0));
    return response;
}