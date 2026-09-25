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

    return NextResponse.next();
}

export const config = {
    matcher: ["/"],
};
