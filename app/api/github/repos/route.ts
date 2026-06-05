import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const cookiesStore = await cookies();
        const token = cookiesStore.get('gh_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Github token not found' }, { status: 401 });
        }

        const allRespo = [];
        let page = 1;

        while (true) {
            const res = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "ai-test-automation-agent"
                }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error("GitHub API error:", res.status, errorData);
                return NextResponse.json(
                    { error: errorData.message || `GitHub API returned status ${res.status}` },
                    { status: res.status }
                );
            }

            const respos = await res.json();

            if (!Array.isArray(respos)) {
                console.error("GitHub API response is not an array:", respos);
                return NextResponse.json(
                    { error: "Invalid response from GitHub API" },
                    { status: 500 }
                );
            }

            if (!respos.length) {
                break;
            }

            allRespo.push(...respos);
            page++;
        }

        return NextResponse.json(allRespo.map(r => ({
            id: r.id,
            name: r.name,
            full_name: r.full_name,
            private_: r.private,
            html_url: r.html_url,
            description: r.description,
            language: r.language,
            default_branch: r.default_branch,
            owner: r.owner?.login || ""
        })));
    } catch (error: any) {
        console.error("Error fetching repositories:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch GitHub repositories" },
            { status: 500 }
        );
    }
}