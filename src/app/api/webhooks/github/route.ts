import { NextResponse } from "next/server";
import { githubFetch, webhookSignatureIsValid } from "@/lib/github";
import { generatePullRequestReview } from "@/lib/review";
import { getGithubInstallation } from "@/lib/database";
import { getInstallationToken } from "@/lib/github-app";

export async function POST(request: Request) {
    const body = await request.text();
    if (!webhookSignatureIsValid(body, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    const event = request.headers.get("x-github-event");
    if (event === "ping") return NextResponse.json({ message: "pong" });
    if (event !== "pull_request") return NextResponse.json({ message: "Ignored" });

    const payload = JSON.parse(body);
    if (!["opened", "synchronize", "reopened"].includes(payload.action)) return NextResponse.json({ message: "Ignored action" });
    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;
    const number = payload.pull_request?.number;
    const installationId = payload.installation?.id;
    const repositoryId = String(payload.repository?.id || "");
    if (!owner || !repo || !number) return NextResponse.json({ message: "Invalid pull request payload" }, { status: 400 });

    try {
        if (!installationId) return NextResponse.json({ message: "GitHub App installation is missing" }, { status: 400 });
        const installation = await getGithubInstallation(String(installationId));
        if (!installation?.enabledRepositoryIds.includes(repositoryId)) return NextResponse.json({ message: "Review is disabled for this repository" });
        const token = await getInstallationToken(installationId);
        const review = await generatePullRequestReview(token, owner, repo, number);
        const comment = `## AI PR Review\n\n### Summary\n${review.summary}\n\n### Key changes\n${review.key_changes}\n\n### Issues found\n${review.issues_found}\n\n### Recommendations\n${review.recommendations}`;
        await githubFetch(token, `/repos/${owner}/${repo}/issues/${number}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment }) });
        return NextResponse.json({ message: "Review posted" });
    } catch (error) {
        console.log("Webhook review error:", error);
        const rawMessage = error instanceof Error ? error.message : "Webhook review failed";
        const message = rawMessage.startsWith("GitHub 403:")
            ? "GitHub rejected the comment. Grant the token Issues: Read and write permission for this repository, then regenerate GITHUB_ACCESS_TOKEN."
            : rawMessage;
        return NextResponse.json({ message }, { status: rawMessage.startsWith("GitHub 403:") ? 403 : 502 });
    }
}