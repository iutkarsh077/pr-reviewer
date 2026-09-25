"use client";

import { FormEvent, useEffect, useState } from "react";

type Repo = { id: string; name: string; fullName: string; owner: string; private: boolean; description: string | null; language: string | null; defaultBranch: string };
type EnabledRepo = { enabled: boolean; webhookId?: string | null };
type Review = { summary: string; key_changes: string; issues_found: string; recommendations: string };

export default function Home() {
    const [repos, setRepos] = useState<Repo[]>([]);
    const [enabled, setEnabled] = useState<Record<string, EnabledRepo>>(() => {
        if (typeof window === "undefined") return {};
        const saved = localStorage.getItem("pr-reviewer-enabled");
        return saved ? JSON.parse(saved) : {};
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [review, setReview] = useState<Review | null>(null);
    const [reviewing, setReviewing] = useState(false);

    async function loadRepos() {
        setLoading(true);
        const response = await fetch("/api/github/repos");
        const data = await response.json();
        if (!response.ok) setError(data.message || "Connect GitHub to continue");
        else setRepos(data.data);
        setLoading(false);
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadRepos().catch(() => { setError("Unable to reach GitHub"); setLoading(false); });
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function toggle(repo: Repo) {
        const current = enabled[repo.id] || { enabled: false };
        const response = await fetch(`/api/github/repos/${repo.owner}/${repo.name}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !current.enabled, webhookId: current.webhookId }) });
        const data = await response.json();
        if (!response.ok) { setError(data.message || "Could not change review status"); return; }
        const next = { ...enabled, [repo.id]: { enabled: data.enabled, webhookId: data.webhookId } };
        setEnabled(next);
        localStorage.setItem("pr-reviewer-enabled", JSON.stringify(next));
    }

    async function runReview(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const match = query.match(/^([^/]+)\/([^#]+)#(\d+)$/);
        if (!match) { setError("Use the format owner/repository#123"); return; }
        setReviewing(true); setReview(null); setError("");
        const response = await fetch("/api/github/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner: match[1], repo: match[2], number: Number(match[3]) }) });
        const data = await response.json();
        if (!response.ok) setError(data.message || "Review failed"); else setReview(data);
        setReviewing(false);
    }

    const filtered = repos.filter((repo) => `${repo.fullName} ${repo.description || ""}`.toLowerCase().includes(query.toLowerCase()));
    return <main className="shell">
        <header className="topbar"><div className="brand"><span className="brand-mark">PR</span><span>reviewer<span className="accent">.</span></span></div><a className="github-link" href="/api/github/install">{repos.length ? "Manage GitHub App" : "Install GitHub App"}<span>↗</span></a></header>
        <section className="hero"><p className="eyebrow">AUTOMATED CODE REVIEW</p><h1>Ship with a second pair of eyes.</h1><p className="lede">Connect your repositories, switch on AI review, and get concise findings posted directly to every pull request.</p></section>
        {error && <div className="notice error">{error}</div>}
        <section className="workspace"><div className="section-heading"><div><p className="eyebrow">01 / REPOSITORIES</p><h2>Your GitHub repositories</h2></div><span className="count">{repos.length} found</span></div><div className="toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter repositories..." aria-label="Filter repositories" />{loading && <span className="status">Loading from GitHub...</span>}</div>
            {!loading && !repos.length && <div className="empty"><strong>Install the GitHub App.</strong><span>Choose which repositories the reviewer can protect.</span><a className="button primary" href="/api/github/install">Install GitHub App</a></div>}
            <div className="repo-grid">{filtered.map((repo) => { const state = enabled[repo.id]?.enabled; return <article className={`repo ${state ? "active" : ""}`} key={repo.id}><div className="repo-top"><span className="repo-icon">{repo.private ? "◼" : "◻"}</span><span className="visibility">{repo.private ? "PRIVATE" : "PUBLIC"}</span><button className={`toggle ${state ? "on" : ""}`} onClick={() => toggle(repo)} aria-label={`${state ? "Disable" : "Enable"} AI review for ${repo.name}`}><span /></button></div><h3>{repo.name}</h3><p className="repo-path">{repo.fullName}</p><p className="description">{repo.description || "No description provided."}</p><div className="repo-footer"><span>{repo.language || "Unknown language"}</span><span>{repo.defaultBranch}</span></div>{state && <div className="enabled-label">AI REVIEW ACTIVE</div>}</article>; })}</div>
        </section>
        <section className="review-section"><div className="section-heading"><div><p className="eyebrow">02 / ON DEMAND</p><h2>Review a pull request</h2></div><span className="count">MANUAL RUN</span></div><form className="review-form" onSubmit={runReview}><input value={query.includes("#") ? query : ""} onChange={(event) => setQuery(event.target.value)} placeholder="owner/repository#123" aria-label="Pull request reference" /><button className="button primary" disabled={reviewing}>{reviewing ? "Reviewing..." : "Run AI review"}</button></form>{review && <div className="report"><div className="report-head"><div><span className="eyebrow">REVIEW COMPLETE</span><h3>{query}</h3></div><span className="report-dot">● READY</span></div><div className="report-grid"><Report title="Summary" value={review.summary} /><Report title="Key changes" value={review.key_changes} /><Report title="Issues found" value={review.issues_found} /><Report title="Recommendations" value={review.recommendations} /></div></div>}</section>
        <footer><span>AI PR REVIEWER</span><span>GitHub-native code confidence</span></footer>
    </main>;
}

function Report({ title, value }: { title: string; value: string }) { return <div className="report-block"><p>{title}</p><div>{value}</div></div>; }
