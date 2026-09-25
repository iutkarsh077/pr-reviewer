import { NextResponse } from "next/server";
import { getLatestGithubInstallation } from "@/lib/database";

/**
 * GET /api/auth/recover
 *
 * When the user clears cookies, the github_installation_id cookie is lost.
 * This endpoint looks up the most recent installation from the database
 * and redirects to the homepage with setup_installation_id so the proxy
 * can re-set the cookie.
 */
export async function GET() {
    const frontendUrl = process.env.FRONT_END_URI || "http://localhost:3000";
    try {
        const installation = await getLatestGithubInstallation();
        if (!installation) {
            // No installation found — redirect back to homepage with error
            // and "recovered" flag to prevent the proxy from looping.
            return NextResponse.redirect(
                new URL("/?error=no_installation&recovered=1", frontendUrl)
            );
        }
        // Redirect to homepage with setup_installation_id so the proxy
        // will set the cookie automatically.
        return NextResponse.redirect(
            new URL(`/?setup_installation_id=${installation.installationId}`, frontendUrl)
        );
    } catch (error) {
        console.error("[auth/recover] Failed to recover session:", error instanceof Error ? error.message : error);
        return NextResponse.redirect(
            new URL("/?error=recovery_failed&recovered=1", frontendUrl)
        );
    }
}
