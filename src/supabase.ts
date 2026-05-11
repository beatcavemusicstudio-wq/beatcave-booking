/**
 * BEATCAVE BOOKING — Client Supabase
 * File: supabase.ts
 */

const BASE = "https://lpznonwpofwywtvikgfm.supabase.co";
const KEY  = "sb_publishable_BGd9aD4jqt6K6txVpDCifA_C-IvCaP_";

export const supabaseUrl = BASE;
export const supabaseKey = KEY;

const H = {
  "apikey":        KEY,
  "Authorization": `Bearer ${KEY}`,
  "Content-Type":  "application/json",
  "Prefer":        "return=representation",
};

async function req(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/rest/v1${path}`, {
    ...options,
    headers: { ...H, ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── AUTH ──

export async function registrati(email: string, password: string, nome: string, telefono: string) {
  const res = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST",
    headers: { "apikey": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? data.error);

  const userId = data.user?.id ?? data.id ?? null;

  // Salva profilo
  if (userId) {
    try {
      await req("/profili", {
        method: "POST",
        body: JSON.stringify({ id: userId, nome: nome || email, telefono: telefono || "" }),
      });
    } catch { /* profilo già esistente */ }
  }

  // Aggiunge il cliente alla tabella clienti del gestionale
  try {
    await req("/clienti", {
      method: "POST",
      body: JSON.stringify({ nome: nome || email, email, telefono: telefono || "" }),
    });
  } catch { /* cliente già esistente con quella email */ }

  return data;
}

export async function accedi(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? data.error);
  return data;
}

export async function esci(token: string) {
  await fetch(`${BASE}/auth/v1/logout`, {
    method: "POST",
    headers: { "apikey": KEY, "Authorization": `Bearer ${token}` },
  });
}

// ── DISPONIBILITÀ ──

export async function fetchDisponibilita() {
  const oggi = new Date().toISOString().split("T")[0];
  const rows = await req(`/disponibilita?data=gte.${oggi}&occupato=eq.false&order=data,ora_inizio`);
  return rows ?? [];
}

// ── RICHIESTE ──

export async function inviaRichiesta(r: {
  cliente_id: string; cliente_nome: string; cliente_email: string;
  disponibilita_id: number; data: string; ora_inizio: string; ora_fine: string;
  tipo: string; note: string;
}) {
  const rows = await req("/richieste", { method: "POST", body: JSON.stringify(r) });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function fetchRichiesteCliente(clienteId: string) {
  const rows = await req(`/richieste?cliente_id=eq.${clienteId}&order=data.desc`);
  return rows ?? [];
}

// ── SESSIONI CLIENTE ──

export async function fetchSessioniCliente(email: string) {
  const rows = await req(`/sessioni?cliente_email=eq.${encodeURIComponent(email)}&order=data.desc`);
  return rows ?? [];
}

// ── PROFILO ──

export async function fetchProfilo(userId: string) {
  const rows = await req(`/profili?id=eq.${userId}`);
  return Array.isArray(rows) ? rows[0] : null;
}

export async function aggiornaProfilo(userId: string, dati: { nome: string; telefono: string }) {
  return req(`/profili?id=eq.${userId}`, { method: "PATCH", body: JSON.stringify(dati) });
}
