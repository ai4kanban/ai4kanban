// Print the hosted board's session cookie for <subject>, as its GitHub sign-in would leave it.
import fs from 'node:fs'
const [sub] = process.argv.slice(2)
const { priv, base } = JSON.parse(fs.readFileSync('/tmp/qa-cloud-trial/key.json', 'utf8'))
const { issuerFor } = await import('/tmp/qa-cloud-trial/repo/cloud/src/auth.ts')
const key = await crypto.subtle.importKey('jwk', priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
const b64 = (b) => Buffer.from(b).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const input = `${b64(JSON.stringify({ alg: 'ES256', kid: 'k' }))}.${b64(JSON.stringify({ sub, iss: issuerFor(base), aud: 'authenticated', exp: now + 86400, user_metadata: {} }))}`
const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input))
process.stdout.write(b64(JSON.stringify({ v: 1, accessToken: `${input}.${b64(new Uint8Array(sig))}`, refreshToken: 'r', expiresAt: Date.now() + 86400e3, subject: sub })))
