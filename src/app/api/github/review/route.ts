import { NextResponse } from "next/server";
import { generatePullRequestReview } from "@/lib/review";
import { getAuthenticatedInstallation, getInstallationToken } from "@/lib/github-app";

export async function POST(request: Request) {
    const { owner, repo, number } = await request.json();
    if (!owner || !repo || !number) return NextResponse.json({ message: "owner, repo, and number are required" }, { status: 400 });
    try {
        const context = await getAuthenticatedInstallation();
        const installationId = context?.installationId;
        const installation = context?.installation;
        const repository = installation?.repositories.find((item) => item.owner === owner && item.name === repo);
        if (!installationId || !repository) return NextResponse.json({ message: "Install the GitHub App for this repository first" }, { status: 401 });
        const token = await getInstallationToken(installationId);
        const report = await generatePullRequestReview(token, owner, repo, number);
        return NextResponse.json({ status: true, ...report });
    } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to review pull request" }, { status: 502 });
    }
}