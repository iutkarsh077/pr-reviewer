import { NextResponse } from "next/server";
import { getAuthenticatedInstallation } from "@/lib/github-app";

export async function GET() {
    const context = await getAuthenticatedInstallation();
    if (!context) return NextResponse.json({ message: "Sign in and install the GitHub App to list repositories" }, { status: 401 });
    try {
        const { installation } = context;
        const enabled = new Set(installation.enabledRepositoryIds);
        return NextResponse.json({ data: installation.repositories.map((repo) => ({ ...repo, enableCodeReview: enabled.has(repo.id) })) });
    } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to list repositories" }, { status: 502 });
    }
}
