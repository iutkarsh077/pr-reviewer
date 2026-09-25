import { NextResponse } from "next/server";

export async function GET() {
    const url = process.env.GITHUB_APP_INSTALL_URL || `https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`;
    return NextResponse.redirect(url);
}