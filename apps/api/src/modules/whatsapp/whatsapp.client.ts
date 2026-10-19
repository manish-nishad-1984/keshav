import https from 'node:https';
import http from 'node:http';

export interface WhatsappConfig {
  apiUrl: string;
  token: string;
  device?: string;
}

export interface ProviderReply {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

// Plain https request (works on any Node version the server runs). Always resolves with the JSON the
// service answered, or { ok: false, error } when it could not be reached or answered with non-JSON.
const call = (method: 'GET' | 'POST', url: string, params: Record<string, string | undefined>): Promise<ProviderReply> =>
  new Promise((resolve) => {
    const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][];
    const body = new URLSearchParams(clean).toString();
    const target = new URL(method === 'GET' && body ? `${url}?${body}` : url);
    const client = target.protocol === 'http:' ? http : https;
    const req = client.request(
      target,
      {
        method,
        timeout: 20000,
        headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            resolve(JSON.parse(text) as ProviderReply);
          } catch {
            resolve({ ok: false, error: `WhatsApp service answered with something unexpected (HTTP ${res.statusCode})` });
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ ok: false, error: `Could not reach the WhatsApp service (${err.message})` }));
    if (method === 'POST') req.write(body);
    req.end();
  });

const base = (cfg: WhatsappConfig) => cfg.apiUrl.replace(/\/+$/, '');
const auth = (cfg: WhatsappConfig) => ({ token: cfg.token, device: cfg.device });

export const sendMessage = (cfg: WhatsappConfig, to: string, message: string, mediaUrl?: string | null) =>
  call('POST', `${base(cfg)}/send`, { ...auth(cfg), to, message, url: mediaUrl ?? undefined });

export const getBalance = (cfg: WhatsappConfig) => call('GET', `${base(cfg)}/balance`, auth(cfg));
export const getDeviceStatus = (cfg: WhatsappConfig) => call('GET', `${base(cfg)}/status`, auth(cfg));
export const getRecentMessages = (cfg: WhatsappConfig, limit = 100) =>
  call('GET', `${base(cfg)}/messages`, { ...auth(cfg), limit: String(limit) });
