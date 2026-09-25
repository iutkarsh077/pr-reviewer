import { NextResponse } from "next/server";
import { getInstallationDetails, getInstallationToken } from "@/lib/github-app";
import { githubFetch } from "@/lib/github";
import { saveGithubInstallation } from "@/lib/database";

function frontendUrl() {
    return process.env.FRONT_END_URI || "http://localhost:3000";
}

export async function GET(request: Request) {
    const installationId = new URL(request.url).searchParams.get("installation_id");
    if (!installationId) return NextResponse.redirect(new URL("/?error=github_installation", frontendUrl()));
    let stage = "installation details";
    try {
        const details = await getInstallationDetails(installationId);
        stage = "installation token";
        const token = await getInstallationToken(installationId);
        stage = "installation repositories";
        const repositories = await githubFetch<{ repositories: { id: number; name: string; full_name: string; private: boolean; description: string | null; language: string | null; default_branch: string; owner: { login: string } }[] }>(token, "/installation/repositories?per_page=100");
        stage = "saving installation to MongoDB";
        await saveGithubInstallation({
            installationId,
            accountId: String(details.account?.id || ""),
            accountLogin: details.account?.login || "",
            repositories: repositories.repositories.map((repo) => ({ id: String(repo.id), name: repo.name, fullName: repo.full_name, owner: repo.owner.login, private: repo.private, description: repo.description, language: repo.language, defaultBranch: repo.default_branch })),
        });
        console.log("[callback] Installation saved, redirecting with setup_installation_id:", installationId);
        // Redirect to frontend with installation ID in query param.
        // Middleware will set the cookie on the correct domain.
        return NextResponse.redirect(new URL(`/?setup_installation_id=${installationId}`, frontendUrl()));
    } catch (error) {
        console.error(`GitHub App installation failed during ${stage}:`, error instanceof Error ? error.message : error);
        return NextResponse.redirect(new URL("/?error=github_installation", frontendUrl()));
    }
}
