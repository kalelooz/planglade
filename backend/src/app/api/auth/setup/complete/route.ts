import { completeSetupRequest } from "@/lib/self-host-setup/complete-request"
import { methodNotAllowed } from "@/lib/self-host-setup/response"

export function POST(request: Request) {
  return completeSetupRequest(request)
}

export const GET = () => methodNotAllowed("POST")
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
export const HEAD = GET
