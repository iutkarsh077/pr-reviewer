import { NextResponse } from "next/server";
import { createOpaqueToken, oauthStateCookieName, secureCookieOptions } from "@/lib/auth";

function appUrl() {
    return process.env.FRONT_END_URI || "http://localhost:3000";
}

export async function GET() {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) return NextResponse.json({ message: "GitHub OAuth is not configured" }, { status: 500 });
    const state = createOpaqueToken();
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", `${appUrl()}/api/auth/github/callback`);
    url.searchParams.set("scope", "read:user repo");
    url.searchParams.set("state", state);
    const response = NextResponse.redirect(url);
    response.cookies.set(oauthStateCookieName, state, secureCookieOptions(600));
    return response;
}