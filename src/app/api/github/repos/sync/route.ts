import { NextResponse } from "next/server";
import { getInstallationIdFromRequest, getInstallationToken } from "@/lib/github-app";
import { githubFetch } from "@/lib/github";
import { saveGithubInstallation, getGithubInstallation } from "@/lib/database";

export async function POST() {
    const installationId = await getInstallationIdFromRequest();
    if (!installationId) return NextResponse.json({ message: "Install the GitHub App first" }, { status: 401 });
    try {
        const existing = await getGithubInstallation(installationId);
        if (!existing) return NextResponse.json({ message: "GitHub installation was not found" }, { status: 404 });
        const token = await getInstallationToken(installationId);
        const result = await githubFetch<{ repositories: { id: number; name: string; full_name: string; private: boolean; description: string | null; language: string | null; default_branch: string; owner: { login: string } }[] }>(token, "/installation/repositories?per_page=100");
        const repositories = result.repositories.map((repo) => ({ id: String(repo.id), name: repo.name, fullName: repo.full_name, owner: repo.owner.login, private: repo.private, description: repo.description, language: repo.language, defaultBranch: repo.default_branch }));
        await saveGithubInstallation({
            installationId,
            accountId: (existing as unknown as { accountId: string }).accountId || "",
            accountLogin: (existing as unknown as { accountLogin: string }).accountLogin || "",
            repositories,
        });
        return NextResponse.json({ data: repositories, message: `Synced ${repositories.length} repositories` });
    } catch (error) {
        console.error("Repo sync failed:", error instanceof Error ? error.message : error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to sync repositories" }, { status: 502 });
    }
}
