import { getSetupDiscovery } from "@/lib/self-host-setup/discovery-request"
import { methodNotAllowed } from "@/lib/self-host-setup/response"

export function GET(request: Request) {
  return getSetupDiscovery(request)
}

export const POST = () => methodNotAllowed("GET")
export const PUT = POST
export const PATCH = POST
export const DELETE = POST
export const HEAD = POST
