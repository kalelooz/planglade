import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GitHubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"

import { getProviderCapabilityResult } from "@/lib/auth-provider-capabilities"
import { db } from "@/lib/db"
import { normalizeEmail } from "@/lib/local-auth-email"
import { resolveLegacyNextAuthUser, resolveVerifiedApplicationUser } from "@/lib/local-auth-identity"
import { getDummyPasswordHash, isPasswordHash, verifyPassword } from "@/lib/local-auth-password"
import { resolveVerifiedOAuthIdentity } from "@/lib/oauth-verified-identity"

const MAX_EMAIL_LENGTH = 320
const MAX_PASSWORD_LENGTH = 1024

function isAuthVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

export async function authorizeLocalCredentials(
  credentials: Record<string, string> | undefined,
  verify = verifyPassword
) {
  try {
    const email = credentials?.email
    const password = credentials?.password
    const normalizedEmail =
      typeof email === "string" && email.length <= MAX_EMAIL_LENGTH
        ? normalizeEmail(email)
        : null
    const usablePassword = typeof password === "string" && password.length <= MAX_PASSWORD_LENGTH
    const credential = normalizedEmail
      ? await db.localCredential.findFirst({
          where: { user: { normalizedEmail } },
          include: {
            user: { select: { id: true, email: true, name: true, image: true, authVersion: true } },
          },
        })
      : null
    const credentialIsUsable = Boolean(
      credential && !credential.disabledAt && isPasswordHash(credential.passwordHash)
    )
    const hashToVerify = credentialIsUsable ? credential!.passwordHash : getDummyPasswordHash()
    const passwordMatches = await verify(usablePassword ? password : "", hashToVerify)

    if (!credentialIsUsable || !passwordMatches || !credential) return null
    return {
      id: credential.user.id,
      email: credential.user.email,
      name: credential.user.name,
      image: credential.user.image,
      authVersion: credential.user.authVersion,
    }
  } catch {
    return null
  }
}

function configuredProviders(): NonNullable<NextAuthOptions["providers"]> {
  const { capabilities } = getProviderCapabilityResult()
  const providers: NonNullable<NextAuthOptions["providers"]> = []

  if (capabilities.github) {
    providers.push(
      GitHubProvider({ clientId: process.env.GITHUB_ID!, clientSecret: process.env.GITHUB_SECRET! })
    )
  }
  if (capabilities.google) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      })
    )
  }
  if (capabilities.localCredentials) {
    providers.push(
      CredentialsProvider({
        name: "Local credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          return authorizeLocalCredentials(credentials)
        },
      })
    )
  }
  return providers
}

export function getAuthOptions(): NextAuthOptions {
  return {
    providers: configuredProviders(),
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    callbacks: {
      async signIn({ user, account, profile }) {
        if (account?.provider === "credentials") return Boolean(user.id && isAuthVersion(user.authVersion))
        try {
          const verifiedIdentity = await resolveVerifiedOAuthIdentity({ user, account, profile })
          if (!verifiedIdentity) return false
          const applicationUser = await resolveVerifiedApplicationUser({
            email: verifiedIdentity.email,
            name: verifiedIdentity.name,
            image: verifiedIdentity.image,
          })
          if (!applicationUser) return false
          user.id = applicationUser.id
          user.authVersion = applicationUser.authVersion
          return true
        } catch {
          return false
        }
      },
      async jwt({ token, user }) {
        if (user?.id && isAuthVersion(user.authVersion)) {
          token.userId = user.id
          token.authVersion = user.authVersion
          return token
        }
        if ((!token.userId || !isAuthVersion(token.authVersion)) && token.email) {
          try {
            const legacyUser = await resolveLegacyNextAuthUser(token.email)
            if (legacyUser) {
              token.userId = legacyUser.id
              token.authVersion = legacyUser.authVersion
            }
          } catch {
            return token
          }
        }
        return token
      },
      session({ session, token }) {
        if (session.user && token.userId && isAuthVersion(token.authVersion)) {
          session.user.id = token.userId
          session.user.authVersion = token.authVersion
        }
        return session
      },
    },
  }
}

export const authOptions = getAuthOptions()

export function hasAuthProviders() {
  return getProviderCapabilityResult().capabilities.anyConfigured
}
