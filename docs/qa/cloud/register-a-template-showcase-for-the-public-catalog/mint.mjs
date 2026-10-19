// Write a signed-in session.json for <subject> into <home>, as `akb cloud login` would leave it.
import fs from 'node:fs'
const [home, sub] = process.argv.slice(2)
const { priv, base } = JSON.parse(fs.readFileSync('/tmp/qa-cloud-cat/key.json', 'utf8'))
const { issuerFor } = await import('/tmp/qa-cloud-cat/repo/cloud/src/auth.ts')
const key = await crypto.subtle.importKey('jwk', priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
const b64 = (b) => Buffer.from(b).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const input = `${b64(JSON.stringify({ alg: 'ES256', kid: 'k' }))}.${b64(JSON.stringify({ sub, iss: issuerFor(base), aud: 'authenticated', exp: now + 86400 }))}`
const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input))
fs.mkdirSync(home, { recursive: true })
fs.writeFileSync(`${home}/session.json`, JSON.stringify({ version: 1, supabaseUrl: base, accessToken: `${input}.${b64(new Uint8Array(sig))}`, refreshToken: 'r', expiresAt: Date.now() + 86400e3, subject: sub }))
