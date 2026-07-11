import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      authVersion: number
    }
  }

  interface User {
    authVersion?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string
    authVersion?: number
  }
}
