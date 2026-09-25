import { createHmac, timingSafeEqual } from "node:crypto";

export const githubApi = "https://api.github.com";

export type GitHubRepo = {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    description: string | null;
    language: string | null;
    default_branch: string;
    owner: { login: string };
};

export type GitHubPrFile = {
    sha: string;
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    blob_url: string;
    raw_url: string;
    contents_url: string;
    patch?: string;
};

export function githubHeaders(token: string) {
    return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ai-pr-reviewer", "X-GitHub-Api-Version": "2022-11-28" };
}

export async function githubFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${githubApi}${path}`, { ...init, headers: { ...githubHeaders(token), ...init?.headers }, cache: "no-store" });
    if (!response.ok) throw new Error(`GitHub ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return response.status === 204 ? (undefined as T) : response.json();
}

export function webhookSignatureIsValid(body: string, signature: string | null) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret || !signature?.startsWith("sha256=")) return false;
    const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}