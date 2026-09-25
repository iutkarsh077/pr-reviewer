import OpenAI from "openai";
import { githubFetch, type GitHubPrFile } from "@/lib/github";

const instructions = "You are a senior software engineer performing a thorough pull request review. Return JSON with summary, key_changes, issues_found, and recommendations. Each field must be 50 words or fewer. Base every claim on the supplied current file content and patch. Use concise bullets. Mention severity for issues and cite file paths.";

function formatReportField(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map((item) => formatReportField(item)).join("\n");
    }
    if (value && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>)
            .map(([key, item]) => `${key}: ${formatReportField(item)}`)
            .join(" | ");
    }
    return String(value ?? "");
}

export async function generatePullRequestReview(token: string, owner: string, repo: string, number: number) {
    const pr = await githubFetch<{ head: { sha: string } }>(token, `/repos/${owner}/${repo}/pulls/${number}`);
    const files = await githubFetch<GitHubPrFile[]>(token, `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`);
    const sections = await Promise.all(files.map(async (file) => {
        const content = file.status === "removed" ? "(file removed in this PR)" : await githubFetch<{ content?: string; encoding?: string }>(token, `/repos/${owner}/${repo}/contents/${file.filename}?ref=${pr.head.sha}`).then((value) => value.encoding === "base64" ? Buffer.from(value.content || "", "base64").toString("utf8") : value.content || "").catch(() => "(content unavailable)");
        return `File: ${file.filename}\nStatus: ${file.status}; additions: ${file.additions}; deletions: ${file.deletions}\nCurrent content:\n${content.slice(0, 20000)}\nPatch:\n${file.patch || "(patch unavailable)"}`;
    }));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "system", content: instructions }, { role: "user", content: `Review ${owner}/${repo} pull request #${number}.\n\n${sections.join("\n\n")}` }] });
    const report = JSON.parse(response.choices[0]?.message.content || "{}");
    return {
        summary: formatReportField(report.summary),
        key_changes: formatReportField(report.key_changes),
        issues_found: formatReportField(report.issues_found),
        recommendations: formatReportField(report.recommendations),
    };
}