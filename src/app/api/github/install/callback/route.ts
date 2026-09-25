import { NextResponse } from "next/server";
import { getInstallationDetails, getInstallationToken } from "@/lib/github-app";
import { githubFetch } from "@/lib/github";
import { saveGithubInstallation } from "@/lib/database";
import { getCurrentUser, secureCookieOptions } from "@/lib/auth";

function frontendUrl() {
    return process.env.FRONT_END_URI || "http://localhost:3000";
}

export async function GET(request: Request) {
    const installationId = new URL(request.url).searchParams.get("installation_id");
    if (!installationId) return NextResponse.redirect(new URL("/?error=github_installation", frontendUrl()));
    let stage = "installation details";
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.redirect(new URL("/?error=login_required", frontendUrl()));
        const details = await getInstallationDetails(installationId);
        const installations = await githubFetch<{ installations: { id: number }[] }>(user.githubAccessToken, "/user/installations?per_page=100");
        if (!installations.installations.some((installation) => String(installation.id) === installationId)) throw new Error("GitHub installation is not accessible to the signed-in user");
        stage = "installation token";
        const token = await getInstallationToken(installationId);
        stage = "installation repositories";
        const repositories = await githubFetch<{ repositories: { id: number; name: string; full_name: string; private: boolean; description: string | null; language: string | null; default_branch: string; owner: { login: string } }[] }>(token, "/installation/repositories?per_page=100");
        stage = "saving installation to MongoDB";
        await saveGithubInstallation({
            installationId,
            userId: user.id,
            accountId: String(details.account?.id || ""),
            accountLogin: details.account?.login || "",
            repositories: repositories.repositories.map((repo) => ({ id: String(repo.id), name: repo.name, fullName: repo.full_name, owner: repo.owner.login, private: repo.private, description: repo.description, language: repo.language, defaultBranch: repo.default_branch })),
        });
        const response = NextResponse.redirect(new URL("/", frontendUrl()));
        response.cookies.set("github_installation_id", installationId, secureCookieOptions(60 * 60 * 24 * 30));
        return response;
    } catch (error) {
        console.error(`GitHub App installation failed during ${stage}:`, error instanceof Error ? error.message : error);
        return NextResponse.redirect(new URL("/?error=github_installation", frontendUrl()));
    }
}

