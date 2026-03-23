/**
 * send-web-push – Supabase Edge Function
 *
 * Sends a Web Push notification using pure Deno Web Crypto (no npm/docker needed).
 * Implements RFC 8291 (Message Encryption) and RFC 8292 (VAPID).
 *
 * Expects JSON body: { user_id, title, body, url? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const VAPID_PUBLIC_KEY = 'BAMW56PhO78oEncQJWP4crslrLPePPyQogP5Ac35QKPzh2MYOUV-HTuKW6LTEi5ZZdLPhZa64js4QSuTksxrtYg'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = 'mailto:support@fastestcrm.com'

// ─── Base64 Helpers ───────────────────────────────────────────────────────────
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(base64 + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ─── VAPID JWT ────────────────────────────────────────────────────────────────
async function buildVapidJWT(audience: string): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const claims = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 43200,
    sub: VAPID_SUBJECT,
  })))
  const unsigned = `${header}.${claims}`

  // Import private key as JWK
  const privKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY)
  const pubKeyBytes = base64UrlDecode(VAPID_PUBLIC_KEY)
  
  // Public key is in uncompressed format (65 bytes, starts with 04)
  // Extract x, y (32 bytes each)
  const x = base64UrlEncode(pubKeyBytes.slice(1, 33))
  const y = base64UrlEncode(pubKeyBytes.slice(33, 65))
  const d = base64UrlEncode(privKeyBytes)

  const jwk = { kty: 'EC', crv: 'P-256', x, y, d }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])

  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  
  // Convert DER to raw r||s (64 bytes)
  const der = new Uint8Array(sig)
  const raw = new Uint8Array(64)
  let offset = 2
  if (der[offset] !== 0x02) throw new Error('Invalid DER sig')
  offset++
  const rLen = der[offset++]
  const rStart = rLen === 33 ? offset + 1 : offset
  raw.set(der.slice(rStart, rStart + 32), 0)
  offset += rLen
  if (der[offset] !== 0x02) throw new Error('Invalid DER sig s')
  offset++
  const sLen = der[offset++]
  const sStart = sLen === 33 ? offset + 1 : offset
  raw.set(der.slice(sStart, sStart + 32), 32)

  return `${unsigned}.${base64UrlEncode(raw)}`
}

// ─── Message Encryption (RFC 8291) ────────────────────────────────────────────
async function encryptPushPayload(plaintext: string, p256dh: string, auth: string): Promise<{ body: Uint8Array; salt: string }> {
  const authSecret = base64UrlDecode(auth)
  const recipientPublicKeyBytes = base64UrlDecode(p256dh)

  // Generate ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])

  // Import recipient's public key
  const recipientPublicKey = await crypto.subtle.importKey(
    'raw', recipientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' }, true, []
  )

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    ephemeralKeyPair.privateKey, 256
  )
  const sharedSecret = new Uint8Array(sharedSecretBits)

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Export ephemeral public key (uncompressed, 65 bytes)
  const ephemeralPublicKeyRaw = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey)
  const senderPublicKey = new Uint8Array(ephemeralPublicKeyRaw)

  // PRK using HKDF extract (auth secret)
  const prkKey = await crypto.subtle.importKey('raw', authSecret, { name: 'HKDF' }, false, ['deriveBits'])

  // key_info for HKDF
  const encoder = new TextEncoder()
  const keyInfo = concat(encoder.encode('WebPush: info\x00'), recipientPublicKeyBytes, senderPublicKey)
  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: sharedSecret, info: keyInfo },
    prkKey, 256
  ))

  // CEK and nonce derivation
  const prkHkdfKey = await crypto.subtle.importKey('raw', prk, { name: 'HKDF' }, false, ['deriveBits'])
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\x00')
  const nonceInfo = encoder.encode('Content-Encoding: nonce\x00')

  const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, prkHkdfKey, 128)
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkHkdfKey, 96)

  const cek = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt'])
  const nonce = new Uint8Array(nonceBits)

  // Add padding byte (0x02 = record delimiter)
  const plaintextBytes = encoder.encode(plaintext)
  const padded = new Uint8Array(plaintextBytes.length + 1)
  padded.set(plaintextBytes)
  padded[plaintextBytes.length] = 0x02

  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, padded))

  // Build the request body: salt (16) + record_size (4) + key_len (1) + sender_public_key (65) + ciphertext
  const body = new Uint8Array(16 + 4 + 1 + 65 + encrypted.length)
  let off = 0
  body.set(salt, off); off += 16
  // Record size: 4096 big-endian
  const view = new DataView(body.buffer)
  view.setUint32(off, 4096, false); off += 4
  body[off++] = 65 // sender_public_key length
  body.set(senderPublicKey, off); off += 65
  body.set(encrypted, off)

  return { body, salt: base64UrlEncode(salt) }
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrays) { out.set(a, off); off += a.length }
  return out
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, title, body, url } = await req.json()

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (!VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_KEY not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (subError) throw subError

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions for user ${user_id}`)
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payloadStr = JSON.stringify({ title, body: body || '', url: url || '/' })
    let sent = 0
    const expiredIds: string[] = []

    for (const sub of subscriptions) {
      try {
        const endpointUrl = new URL(sub.endpoint)
        const audience = `${endpointUrl.protocol}//${endpointUrl.host}`

        const jwt = await buildVapidJWT(audience)
        const { body: encryptedBody } = await encryptPushPayload(payloadStr, sub.p256dh, sub.auth)

        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
            'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
          },
          body: encryptedBody,
        })

        const respText = await response.text()
        console.log(`Push to ${sub.endpoint.substring(0, 40)}...: ${response.status} ${respText.substring(0, 100)}`)

        if (response.status === 201 || response.status === 200) {
          sent++
        } else if (response.status === 404 || response.status === 410) {
          expiredIds.push(sub.id)
        } else {
          console.error(`Push failed: ${response.status} ${respText}`)
        }
      } catch (pushError) {
        console.error(`Error sending push:`, pushError)
      }
    }

    if (expiredIds.length > 0) {
      await supabaseClient.from('push_subscriptions').delete().in('id', expiredIds)
    }

    return new Response(JSON.stringify({ success: true, sent, expired: expiredIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('send-web-push error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
