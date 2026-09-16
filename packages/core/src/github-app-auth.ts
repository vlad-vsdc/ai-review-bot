import { readFileSync } from 'node:fs'
import jsonwebtoken from 'jsonwebtoken'

const APP_JWT_TTL_SECONDS = 10 * 60

export function generateAppJWT(appId: string, privateKeyPath: string): string {
  const privateKey = readFileSync(privateKeyPath, 'utf8')
  const now = Math.floor(Date.now() / 1000)

  return jsonwebtoken.sign(
    {
      iss: appId,
      iat: now,
      exp: now + APP_JWT_TTL_SECONDS,
    },
    privateKey,
    { algorithm: 'RS256' }
  )
}

export async function getInstallationToken(jwt: string, installationId: number): Promise<string> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get installation token: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { token: string }
  return data.token
}

const INSTALLATION_TOKEN_TTL_MS = 50 * 60 * 1000

const installationTokenCache = new Map<number, { token: string; expiresAt: number }>()

export async function getCachedInstallationToken(
  appId: string,
  privateKeyPath: string,
  installationId: number
): Promise<string> {
  const cached = installationTokenCache.get(installationId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token
  }
  const jwt = generateAppJWT(appId, privateKeyPath)
  const token = await getInstallationToken(jwt, installationId)
  installationTokenCache.set(installationId, { token, expiresAt: Date.now() + INSTALLATION_TOKEN_TTL_MS })
  return token
}
