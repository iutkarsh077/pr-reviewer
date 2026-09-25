import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { githubApi, githubHeaders } from "@/lib/github";

function required(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not configured`);
    return value;
}

export async function createGithubAppJwt() {
    const appId = required("GITHUB_APP_ID");
    const configuredKey = process.env.GITHUB_APP_PRIVATE_KEY_BASE64
        ? Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY_BASE64, "base64").toString("utf8")
        : required("GITHUB_APP_PRIVATE_KEY");
    const privateKeyPem = configuredKey.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n").trim();
    let privateKey;
    try {
        privateKey = createPrivateKey(privateKeyPem);
    } catch {
        throw new Error("GITHUB_APP_PRIVATE_KEY is invalid. Use the complete GitHub .pem contents with literal \\n characters, or configure GITHUB_APP_PRIVATE_KEY_BASE64.");
    }
    return new SignJWT({})
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuer(appId)
        .setIssuedAt()
        .setExpirationTime("10m")
        .sign(privateKey);
}

export async function getInstallationToken(installationId: string | number) {
    const jwt = await createGithubAppJwt();
    const response = await fetch(`${githubApi}/app/installations/${installationId}/access_tokens`, {
        method: "POST",
        headers: { ...githubHeaders(jwt), Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        cache: "no-store",
    });
    if (!response.ok) throw new Error(`GitHub installation token failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    const data = await response.json() as { token: string };
    return data.token;
}

export async function getInstallationDetails(installationId: string | number) {
    const jwt = await createGithubAppJwt();
    const response = await fetch(`${githubApi}/app/installations/${installationId}`, { headers: { ...githubHeaders(jwt), Authorization: `Bearer ${jwt}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`GitHub installation lookup failed (${response.status})`);
    return response.json() as Promise<{ id: number; account?: { id: number; login?: string; login_type?: string }; repository_selection: string }>;
}

export async function getInstallationIdFromRequest() {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookie = cookieStore.get("github_installation_id");
    console.log("[getInstallationIdFromRequest] cookie value:", cookie?.value ?? "NOT FOUND", "all cookies:", cookieStore.getAll().map(c => c.name));
    return cookie?.value || null;
}