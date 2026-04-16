/**
 * Catch-all proxy: /api/proxy/* → BACKEND_INTERNAL_URL/*
 *
 * - Forwards method, headers (minus host), and body as streams.
 * - Pass-through of Set-Cookie from backend → browser (critical for session).
 * - Handles SSE streaming with no buffering.
 */

import { type NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailers",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
  "host",
  // Prevent backend from gzip-encoding — the proxy stream can't reliably
  // re-encode, so strip accept-encoding and content-encoding end-to-end.
  "accept-encoding",
  "content-encoding",
]);

async function proxy(req: NextRequest, params: { path: string[] }): Promise<Response> {
  const path = params.path.join("/");
  const url = new URL(`${BACKEND}/${path}`);

  // Forward query string
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

  // Build forwarded headers (strip hop-by-hop)
  const fwdHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      fwdHeaders.set(key, value);
    }
  });

  const backendRes = await fetch(url.toString(), {
    method: req.method,
    headers: fwdHeaders,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    // @ts-expect-error - duplex is required for streaming bodies
    duplex: "half",
    redirect: "follow",
  });

  // Build response headers (strip hop-by-hop, keep Set-Cookie)
  const resHeaders = new Headers();
  backendRes.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      resHeaders.append(key, value);
    }
  });

  // Streaming response — pass body directly
  return new Response(backendRes.body, {
    status: backendRes.status,
    statusText: backendRes.statusText,
    headers: resHeaders,
  });
}

export const GET = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then((p) => proxy(req, p));
export const POST = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then((p) => proxy(req, p));
export const PATCH = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then((p) => proxy(req, p));
export const DELETE = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then((p) => proxy(req, p));
export const PUT = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then((p) => proxy(req, p));

// Disable Next.js body parsing for streaming
export const dynamic = "force-dynamic";
// Allow up to 60 s for Render free-tier cold starts (requires Vercel Pro+;
// on Hobby the cap is 10 s — the UI shows an error and lets the user retry).
export const maxDuration = 60;
