import { NextResponse } from "next/server";
import { getInstallationIdFromRequest } from "@/lib/github-app";
import { getGithubInstallation } from "@/lib/database";

export async function GET() {
    const installationId = await getInstallationIdFromRequest();
    if (!installationId) return NextResponse.json({ message: "Install the GitHub App to list repositories" }, { status: 401 });
    try {
        const installation = await getGithubInstallation(installationId);
        if (!installation) return NextResponse.json({ message: "GitHub installation was not found" }, { status: 404 });
        const enabled = new Set(installation.enabledRepositoryIds);
        return NextResponse.json({ data: installation.repositories.map((repo) => ({ ...repo, enableCodeReview: enabled.has(repo.id) })) });
    } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to list repositories" }, { status: 502 });
    }
}
