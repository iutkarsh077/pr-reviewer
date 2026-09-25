import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
    const { searchParams, pathname } = request.nextUrl;
    const setupInstallationId = searchParams.get("setup_installation_id");

    if (setupInstallationId && pathname === "/") {
        // The callback redirected here with the installation ID in the URL.
        // Set the cookie on this domain (localhost) and redirect without the query param.
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.searchParams.delete("setup_installation_id");
        cleanUrl.searchParams.delete("recovered");

        const response = NextResponse.redirect(cleanUrl);
        response.cookies.set("github_installation_id", setupInstallationId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
        });
        console.log("[middleware] Set github_installation_id cookie:", setupInstallationId);
        return response;
    }
    // Auto-recover: if no cookie and no setup flow in progress, try to restore
    // the session from the database. The "recovered" param prevents infinite loops.
    const hasCookie = request.cookies.has("github_installation_id");
    const hasError = searchParams.has("error");
    const alreadyRecovered = searchParams.has("recovered");
    if (!hasCookie && pathname === "/" && !hasError && !alreadyRecovered) {
        const recoverUrl = request.nextUrl.clone();
        recoverUrl.pathname = "/api/auth/recover";
        recoverUrl.searchParams.set("recovered", "1");
        return NextResponse.redirect(recoverUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/"],
};
