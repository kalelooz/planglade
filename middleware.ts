import { NextResponse, type NextRequest } from "next/server"

import { DEMO_MODE_MESSAGE } from "@/lib/demo-data"

const DEMO_HEADER = "x-planglade-demo-mode"
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const ROOT_LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PlanGlade</title>
  <meta name="description" content="Open-source workspace for tasks, projects, notes, and calendar planning. Self-host now. Cloud soon." />
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#fafafa;color:#18181b}
    main{min-height:100vh;display:grid;place-items:center;padding:32px}
    section{max-width:720px}
    h1{font-size:clamp(42px,8vw,72px);line-height:1;margin:0 0 18px}
    p{font-size:18px;line-height:1.6;color:#52525b;margin:0 0 24px}
    .actions{display:flex;flex-wrap:wrap;gap:12px}
    a{display:inline-flex;height:42px;align-items:center;border-radius:8px;padding:0 16px;font-size:14px;font-weight:700;text-decoration:none}
    .primary{background:#18181b;color:white}
    .secondary{border:1px solid #d4d4d8;color:#27272a;background:white}
  </style>
</head>
<body>
  <main>
    <section>
      <h1>PlanGlade</h1>
      <p>A calm, open-source workspace for tasks, projects, notes, and calendar planning. Self-host now. Cloud soon.</p>
      <div class="actions">
        <a class="primary" href="/demo">Try demo</a>
        <a class="secondary" href="https://github.com/kalelooz/planglade#self-hosting-status">Self-host</a>
      </div>
    </section>
  </main>
</body>
</html>`

function readPlanGladeEnv(name: string) {
  return process.env[`PLANGLADE_${name}`] ?? process.env[`FLOWBOARD_${name}`]
}

function hasNextAuthProvider() {
  return Boolean(
    (process.env.GITHUB_ID && process.env.GITHUB_SECRET) ||
      (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  )
}

function isPublicOnlyProductionApp() {
  return (
    process.env.NODE_ENV === "production" &&
    readPlanGladeEnv("AUTH_MODE")?.toLowerCase() === "nextauth" &&
    !hasNextAuthProvider()
  )
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return new NextResponse(ROOT_LANDING_HTML, {
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  }

  if (
    request.nextUrl.pathname.startsWith("/app") &&
    isPublicOnlyProductionApp()
  ) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (
    request.nextUrl.pathname.startsWith("/api") &&
    !SAFE_METHODS.has(request.method.toUpperCase()) &&
    request.headers.get(DEMO_HEADER)?.toLowerCase() === "true"
  ) {
    return NextResponse.json({ error: DEMO_MODE_MESSAGE }, { status: 403 })
  }

  return undefined
}

export const config = {
  matcher: ["/", "/api/:path*", "/app/:path*", "/demo", "/demo/:path*"],
}
