import { NextResponse } from "next/server";
import { getInstallationIdFromRequest } from "@/lib/github-app";
import { getGithubInstallation, setRepositoryReviewEnabled } from "@/lib/database";

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function POST(request: Request, { params }: Params) {
    const installationId = await getInstallationIdFromRequest();
    if (!installationId) return NextResponse.json({ message: "Install the GitHub App first" }, { status: 401 });
    const { owner, repo } = await params;
    const body = await request.json() as { enabled?: boolean };
    try {
        const installation = await getGithubInstallation(installationId);
        const repository = installation?.repositories.find((item) => item.owner === owner && item.name === repo);
        if (!repository) return NextResponse.json({ message: "Repository is not included in this GitHub App installation" }, { status: 404 });
        const updated = await setRepositoryReviewEnabled(installationId, repository.id, Boolean(body.enabled));
        return NextResponse.json({ enabled: updated?.enabledRepositoryIds.includes(repository.id) || false });
    } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to change review status" }, { status: 502 });
    }
}
