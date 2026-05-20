import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "flowboard-api",
    time: new Date().toISOString(),
  })
}
