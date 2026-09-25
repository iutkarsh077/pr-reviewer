import { NextResponse } from "next/server";
import { createSession, oauthStateCookieName, secureCookieOptions, sessionCookieName } from "@/lib/auth";
import { upsertGithubUser } from "@/lib/database";

function appUrl() {
    return process.env.FRONT_END_URI || "http://localhost:3000";
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = request.headers.get("cookie")?.match(/(?:^|; )github_oauth_state=([^;]+)/)?.[1];
    if (!code || !state || !cookieState || state !== decodeURIComponent(cookieState)) return NextResponse.redirect(new URL("/?error=github_login", appUrl()));

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) return NextResponse.redirect(new URL("/?error=github_login_config", appUrl()));

    try {
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: `${appUrl()}/api/auth/github/callback` }),
        });
        const tokenData = await tokenResponse.json() as { access_token?: string };
        if (!tokenResponse.ok || !tokenData.access_token) throw new Error("GitHub token exchange failed");

        const userResponse = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "ai-pr-reviewer" } });
        const githubUser = await userResponse.json() as { id?: number; login?: string; name?: string | null; avatar_url?: string };
        if (!userResponse.ok || !githubUser.id || !githubUser.login) throw new Error("GitHub user lookup failed");

        const user = await upsertGithubUser({ githubId: String(githubUser.id), login: githubUser.login, name: githubUser.name, avatarUrl: githubUser.avatar_url, githubAccessToken: tokenData.access_token });
        const sessionToken = await createSession(user.id);
        const response = NextResponse.redirect(new URL("/", appUrl()));
        response.cookies.set(sessionCookieName, sessionToken, secureCookieOptions(60 * 60 * 24 * 30));
        response.cookies.set(oauthStateCookieName, "", secureCookieOptions(0));
        return response;
    } catch (error) {
        console.error("GitHub login failed:", error instanceof Error ? error.message : error);
        return NextResponse.redirect(new URL("/?error=github_login", appUrl()));
    }
}