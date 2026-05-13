// @ts-nocheck
/**
 * BEATCAVE BOOKING — Portal Clienti
 * File: App.tsx
 */

import { useState, useEffect, useRef } from "react";
import {
  registrati, accedi, esci,
  fetchDisponibilita, inviaRichiesta,
  fetchRichiesteCliente, fetchSessioniCliente,
  fetchProfilo, aggiornaProfilo, resetPassword,
} from "./supabase";

const C = {
  orange:      "#E8610A",
  orangeLight: "#FEF0E6",
  dark:        "#0D0D0D",
  green:       "#1D9E75",
  greenLight:  "#E1F5EE",
  greenDark:   "#0F6E56",
  amber:       "#BA7517",
  amberLight:  "#FAEEDA",
  amberDark:   "#854F0B",
  purple:      "#534AB7",
  purpleLight: "#EEEDFE",
  border:      "rgba(0,0,0,0.08)",
  bg:          "#f5f5f5",
} as const;

const MESI       = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_BREVI = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const GIORNI_BREVI = ["L","M","M","G","V","S","D"];

const PUBLIC_URL = "https://audio.beatcavestudio.it";
const SUPA_BASE  = "https://lpznonwpofwywtvikgfm.supabase.co/rest/v1";
const SUPA_KEY   = "sb_publishable_BGd9aD4jqt6K6txVpDCifA_C-IvCaP_";
const SUPA_H     = { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" };

async function supaReq(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPA_BASE}${path}`, { ...options, headers: { ...SUPA_H, ...(options?.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

type Tab = "prenota" | "sessioni" | "brani" | "profilo";

interface Utente { id: string; email: string; token: string; }
interface Profilo { nome: string; telefono: string; }
interface Disponibilita { id: number; data: string; ora_inizio: string; ora_fine: string; occupato: boolean; }
interface Richiesta { id: number; data: string; ora_inizio: string; ora_fine: string; tipo: string; stato: string; note: string; }
interface Sessione { id: number; data: string; ora_inizio: string; ora_fine: string; tipo: string; stato: string; prezzo: number; pagato: boolean; }
interface AudioFile { id: number; brano: string; nome_file: string; storage_path: string; }

function giornoSettimana(d: Date): number { return (d.getDay() + 6) % 7; }

function generaGriglia(anno: number, mese: number) {
  const primo  = new Date(anno, mese, 1);
  const ultimo = new Date(anno, mese + 1, 0);
  const offset = giornoSettimana(primo);
  const prec   = new Date(anno, mese, 0);
  const celle = [];
  for (let i = offset - 1; i >= 0; i--) {
    const g = prec.getDate() - i;
    const m = mese === 0 ? 11 : mese - 1;
    const a = mese === 0 ? anno - 1 : anno;
    celle.push({ giorno: g, corrente: false, iso: `${a}-${String(m+1).padStart(2,"0")}-${String(g).padStart(2,"0")}` });
  }
  for (let g = 1; g <= ultimo.getDate(); g++) {
    celle.push({ giorno: g, corrente: true, iso: `${anno}-${String(mese+1).padStart(2,"0")}-${String(g).padStart(2,"0")}` });
  }
  let ex = 1;
  while (celle.length % 7 !== 0) {
    const ms = mese === 11 ? 0 : mese + 1;
    const as = mese === 11 ? anno + 1 : anno;
    celle.push({ giorno: ex++, corrente: false, iso: `${as}-${String(ms+1).padStart(2,"0")}-${String(ex-1).padStart(2,"0")}` });
  }
  return celle;
}

function formatDataLeggibile(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}`;
}

function oggiISO(): string { return new Date().toISOString().split("T")[0]; }

function badgeSessione(stato: string) {
  switch (stato) {
    case "confermata":    return { label: "Confermata",    bg: C.greenLight,  color: C.greenDark };
    case "in_corso":      return { label: "In corso",      bg: C.orangeLight, color: C.orange    };
    case "da_confermare": return { label: "Da confermare", bg: C.amberLight,  color: C.amberDark };
    default:              return { label: stato,           bg: "#f0f0f0",     color: "#888"      };
  }
}

const TIPO_COLORI: Record<string, string> = {
  Registrazione: C.orange,
  Mixing:        C.green,
  Produzione:    C.purple,
  Mastering:     C.amber,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.9px", marginBottom: 8 }}>{children}</div>;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, ...style }}>{children}</div>;
}

function LoadingScreen() {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", background: C.dark, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'SF Pro Text','Helvetica Neue',Arial,sans-serif" }}>
      <img src="/logo.png" alt="Beatcave Studio" style={{ height: 36, width: "auto", filter: "brightness(0) invert(1)", display: "block", marginBottom: 24 }} />
      <div style={{ display: "flex", gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange, opacity: 0.3 + i * 0.3 }} />)}
      </div>
    </div>
  );
}

// ── PLAYER AUDIO ──
function AudioPlayer({ url, nome }: { url: string; nome: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const formatTime = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.purpleLight, borderRadius: 10, padding: "10px 12px" }}>
      <audio ref={audioRef} src={url}
        onTimeUpdate={e => setProgress((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)} />
      <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: "50%", background: C.purple, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        {playing
          ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="1" width="3" height="10" rx="1" fill="#fff"/><rect x="7" y="1" width="3" height="10" rx="1" fill="#fff"/></svg>
          : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 1l8 5-8 5V1z" fill="#fff"/></svg>
        }
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.purple, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{nome}</div>
        <div style={{ height: 4, background: "rgba(83,74,183,0.2)", borderRadius: 2, overflow: "hidden", cursor: "pointer" }}
          onClick={e => {
            if (!audioRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = x * audioRef.current.duration;
          }}>
          <div style={{ height: "100%", width: `${progress}%`, background: C.purple, borderRadius: 2, transition: "width 0.1s" }} />
        </div>
      </div>
      <div style={{ fontSize: 10, color: C.purple, flexShrink: 0 }}>{formatTime(duration)}</div>
    </div>
  );
}

// ── TAB I TUOI BRANI ──
function TabBrani({ utente }: { utente: Utente }) {
  const [files, setFiles]     = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supaReq(`/audio_files?cliente_email=eq.${encodeURIComponent(utente.email)}&order=brano,creato_il`)
      .then(rows => { setFiles(rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const perBrano = files.reduce((acc, f) => {
    if (!acc[f.brano]) acc[f.brano] = [];
    acc[f.brano].push(f);
    return acc;
  }, {} as Record<string, AudioFile[]>);

  const brani = Object.keys(perBrano).sort();

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#aaa" }}>Caricamento…</div>;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", paddingBottom: 80, display: "flex", flexDirection: "column", gap: 12 }}>
      {brani.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎵</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#555", marginBottom: 6 }}>Nessun file ancora</div>
          <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>
            Lo studio caricherà qui i tuoi brani<br/>dopo le sessioni
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            {files.length} file · {brani.length} {brani.length === 1 ? "brano" : "brani"}
          </div>
          {brani.map(brano => (
            <div key={brano} style={{ background: "#fff", border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>🎵</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{brano}</span>
                <span style={{ fontSize: 10, color: "#aaa", background: "#f0f0f0", padding: "2px 8px", borderRadius: 8 }}>{perBrano[brano].length} file</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {perBrano[brano].map(f => (
  <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <AudioPlayer url={`${PUBLIC_URL}/${f.storage_path}`} nome={f.nome_file} />
    <a href={`${PUBLIC_URL}/${f.storage_path}`} download={f.nome_file}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.purple, background: C.purpleLight, padding: "8px", borderRadius: 8, textDecoration: "none" }}>
      ⬇ Scarica
    </a>
  </div>
))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── LOGIN / REGISTRAZIONE ──
function SchermatAuth({ onLogin }: { onLogin: (u: Utente) => void }) {
  const [modo, setModo]         = useState<"login" | "registrati">("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome]         = useState("");
  const [telefono, setTelefono] = useState("");
  const [errore, setErrore]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [resetInviato, setResetInviato] = useState(false);

const handleReset = async () => {
  if (!email.trim()) { setErrore("Inserisci la tua email prima"); return; }
  setLoading(true);
  try {
    await resetPassword(email);
    setResetInviato(true);
  } catch { setErrore("Errore nell'invio. Controlla l'email."); }
  finally { setLoading(false); }
};

  const handleSubmit = async () => {
    setErrore("");
    setLoading(true);
    try {
      if (modo === "registrati") {
        if (!nome.trim()) { setErrore("Inserisci il tuo nome"); setLoading(false); return; }
        if (!telefono.trim()) { setErrore("Inserisci il tuo numero di telefono"); setLoading(false); return; }
        await registrati(email, password, nome.trim(), telefono.trim());
      }
      const data = await accedi(email, password);
      if (!data?.user?.id) throw new Error("Login fallito");
      onLogin({ id: data.user.id, email: data.user.email, token: data.access_token });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      if (msg.includes("Invalid")) setErrore("Email o password errati");
      else if (msg.includes("already")) setErrore("Email già registrata");
      else if (msg.includes("not confirmed")) setErrore("Controlla la tua email per confermare l'account");
      else setErrore(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100dvh", background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'SF Pro Text','Helvetica Neue',Arial,sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ background: C.dark, paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)", paddingBottom: 28, paddingLeft: 20, paddingRight: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <img src="/logo.png" alt="Beatcave Studio" style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)", display: "block" }} />
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Portale clienti</div>
      </div>
      <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", borderRadius: 10, border: `0.5px solid ${C.border}`, overflow: "hidden", background: "#fff" }}>
          <button onClick={() => setModo("login")} style={{ flex: 1, padding: "11px", fontSize: 13, fontWeight: modo === "login" ? 700 : 500, border: "none", cursor: "pointer", background: modo === "login" ? C.orange : "#fff", color: modo === "login" ? "#fff" : "#888" }}>Accedi</button>
          <button onClick={() => setModo("registrati")} style={{ flex: 1, padding: "11px", fontSize: 13, fontWeight: modo === "registrati" ? 700 : 500, border: "none", borderLeft: `0.5px solid ${C.border}`, cursor: "pointer", background: modo === "registrati" ? C.orange : "#fff", color: modo === "registrati" ? "#fff" : "#888" }}>Registrati</button>
        </div>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {modo === "registrati" && (
              <>
                <div>
                  <SectionLabel>Nome completo</SectionLabel>
                  <input type="text" placeholder="Mario Bianchi" value={nome} onChange={e => setNome(e.target.value)}
                    style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `0.5px solid ${C.border}`, fontSize: 14, boxSizing: "border-box" as const, outline: "none" }} />
                </div>
                <div>
                  <SectionLabel>Telefono</SectionLabel>
                  <input type="tel" placeholder="+39 333 123 4567" value={telefono} onChange={e => setTelefono(e.target.value)}
                    style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `0.5px solid ${C.border}`, fontSize: 14, boxSizing: "border-box" as const, outline: "none" }} />
                </div>
              </>
            )}
            <div>
              <SectionLabel>Email</SectionLabel>
              <input type="email" placeholder="mario@email.com" value={email} onChange={e => setEmail(e.target.value)}
                style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `0.5px solid ${C.border}`, fontSize: 14, boxSizing: "border-box" as const, outline: "none" }} />
            </div>
            <div>
              <SectionLabel>Password</SectionLabel>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `0.5px solid ${C.border}`, fontSize: 14, boxSizing: "border-box" as const, outline: "none" }} />
            </div>
            {errore && <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", padding: "8px 12px", borderRadius: 8 }}>{errore}</div>}
            <button onClick={handleSubmit} disabled={loading}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: loading ? "#ccc" : C.orange, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
              {loading ? "Caricamento…" : modo === "login" ? "Accedi" : "Crea account"}
            </button>
            {modo === "login" && (
  <div style={{ textAlign: "center" }}>
    {resetInviato ? (
      <div style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>✓ Email inviata! Controlla la tua casella.</div>
    ) : (
      <button onClick={handleReset} style={{ fontSize: 12, color: C.orange, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
        Password dimenticata?
      </button>
    )}
  </div>
)}
          </div>
        </Card>
        <div style={{ background: C.orangeLight, borderRadius: 10, padding: "10px 13px", fontSize: 12, color: C.orange, lineHeight: 1.5 }}>
          <strong>Beatcave Studio</strong> — Prenota le tue sessioni e tieni traccia di tutto in un unico posto.
        </div>
      </div>
    </div>
  );
}

// ── TAB PRENOTA ──
function TabPrenota({ utente, profilo }: { utente: Utente; profilo: Profilo | null }) {
  const now = new Date();
  const [anno, setAnno]           = useState(now.getFullYear());
  const [mese, setMese]           = useState(now.getMonth());
  const [giornoSel, setGiornoSel] = useState(oggiISO());
  const [disponibilita, setDisp]  = useState<Disponibilita[]>([]);
  const [loading, setLoading]     = useState(true);
  const [slotSel, setSlotSel]     = useState<Disponibilita | null>(null);
  const [tipo, setTipo]           = useState("Registrazione");
  const [note, setNote]           = useState("");
  const [inviando, setInviando]   = useState(false);
  const [successo, setSuccesso]   = useState(false);

  useEffect(() => {
    fetchDisponibilita().then(rows => { setDisp(rows); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const prev = () => { if (mese === 0) { setAnno(a => a - 1); setMese(11); } else setMese(m => m - 1); };
  const next = () => { if (mese === 11) { setAnno(a => a + 1); setMese(0); } else setMese(m => m + 1); };

  const celle = generaGriglia(anno, mese);
  const giorniConSlot = new Set(disponibilita.map(d => d.data));
  const slotGiorno = disponibilita.filter(d => d.data === giornoSel);
  const oggiStr = oggiISO();

  const handleInvia = async () => {
    if (!slotSel) return;
    setInviando(true);
    try {
      await inviaRichiesta({
        cliente_id: utente.id, cliente_nome: profilo?.nome ?? utente.email,
        cliente_email: utente.email, disponibilita_id: slotSel.id,
        data: slotSel.data, ora_inizio: slotSel.ora_inizio, ora_fine: slotSel.ora_fine,
        tipo, note,
      });
      setSuccesso(true);
      setSlotSel(null);
      setNote("");
      setTimeout(() => setSuccesso(false), 3000);
      fetchDisponibilita().then(rows => setDisp(rows));
    } catch { alert("Errore nell'invio della richiesta. Riprova."); }
    finally { setInviando(false); }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", paddingBottom: 80, display: "flex", flexDirection: "column", gap: 12 }}>
      {successo && (
        <div style={{ background: C.green, color: "#fff", borderRadius: 10, padding: "12px 14px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
          ✓ Richiesta inviata! Ti confermeremo presto.
        </div>
      )}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{MESI[mese]} {anno}</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={prev} style={{ width: 28, height: 28, borderRadius: 7, border: `0.5px solid ${C.border}`, background: "#f5f5f5", fontSize: 13, cursor: "pointer", color: "#555" }}>‹</button>
            <button onClick={() => { setAnno(now.getFullYear()); setMese(now.getMonth()); setGiornoSel(oggiISO()); }} style={{ height: 28, padding: "0 10px", borderRadius: 7, border: `0.5px solid ${C.border}`, background: "#f5f5f5", fontSize: 11, fontWeight: 600, cursor: "pointer", color: C.orange }}>Oggi</button>
            <button onClick={next} style={{ width: 28, height: 28, borderRadius: 7, border: `0.5px solid ${C.border}`, background: "#f5f5f5", fontSize: 13, cursor: "pointer", color: "#555" }}>›</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
          {GIORNI_BREVI.map((g, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#aaa", padding: "2px 0" }}>{g}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {celle.map((cella, i) => {
            const isOggi  = cella.iso === oggiStr;
            const isSel   = cella.iso === giornoSel;
            const hasSlot = giorniConSlot.has(cella.iso);
            let bg = "transparent", color = cella.corrente ? "#333" : "#ccc", fontWeight = 400, border = "none";
            if (isOggi) { bg = C.orange; color = "#fff"; fontWeight = 700; }
            else if (isSel && cella.corrente) { bg = C.orangeLight; color = C.orange; fontWeight = 700; border = `1.5px solid ${C.orange}`; }
            return (
              <div key={i} onClick={() => cella.corrente && setGiornoSel(cella.iso)}
                style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 12, borderRadius: 8, position: "relative", cursor: cella.corrente ? "pointer" : "default", background: bg, color, fontWeight, border }}>
                {cella.giorno}
                {hasSlot && <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: isOggi ? "rgba(255,255,255,0.8)" : C.orange }} />}
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionLabel>Slot disponibili — {formatDataLeggibile(giornoSel)}</SectionLabel>
        {loading ? (
          <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "12px 0" }}>Caricamento…</div>
        ) : slotGiorno.length === 0 ? (
          <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "12px 0" }}>Nessuno slot disponibile in questa data</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {slotGiorno.map(slot => {
              const sel = slotSel?.id === slot.id;
              return (
                <button key={slot.id} onClick={() => setSlotSel(sel ? null : slot)}
                  style={{ padding: "11px 8px", borderRadius: 10, border: `${sel ? "1.5px" : "0.5px"} solid ${sel ? C.orange : C.border}`, background: sel ? C.orangeLight : "#fff", fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? C.orange : "#555", cursor: "pointer" }}>
                  {slot.ora_inizio} – {slot.ora_fine}
                </button>
              );
            })}
          </div>
        )}
      </Card>
      {slotSel && (
        <Card>
          <SectionLabel>Dettagli richiesta</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <SectionLabel>Tipo sessione</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {["Registrazione","Mixing","Produzione","Mastering"].map(t => (
                  <button key={t} onClick={() => setTipo(t)}
                    style={{ padding: "9px 8px", borderRadius: 9, border: `${tipo === t ? "1.5px" : "0.5px"} solid ${tipo === t ? TIPO_COLORI[t] : C.border}`, background: tipo === t ? `${TIPO_COLORI[t]}18` : "#fff", fontSize: 12, fontWeight: tipo === t ? 700 : 500, color: tipo === t ? TIPO_COLORI[t] : "#555", cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>Note (opzionale)</SectionLabel>
              <textarea placeholder="Aggiungi una nota per lo studio…" value={note} onChange={e => setNote(e.target.value)} rows={3}
                style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `0.5px solid ${C.border}`, fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" }} />
            </div>
            <div style={{ background: C.orangeLight, borderRadius: 9, padding: "10px 12px", fontSize: 12, color: C.orange, lineHeight: 1.5 }}>
              Stai richiedendo: <strong>{slotSel.ora_inizio} – {slotSel.ora_fine}</strong> il <strong>{formatDataLeggibile(slotSel.data)}</strong>
            </div>
            <button onClick={handleInvia} disabled={inviando}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: inviando ? "#ccc" : C.orange, color: "#fff", fontSize: 15, fontWeight: 700, cursor: inviando ? "default" : "pointer" }}>
              {inviando ? "Invio in corso…" : "Invia richiesta"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── TAB SESSIONI ──
function TabSessioni({ utente }: { utente: Utente }) {
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [sessioni, setSessioni]   = useState<Sessione[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetchRichiesteCliente(utente.id),
      fetchSessioniCliente(utente.email),
    ]).then(([r, s]) => { setRichieste(r); setSessioni(s); setLoading(false); })
    .catch(() => setLoading(false));
  }, []);

  const oggi = oggiISO();
  const sessioniFuture  = sessioni.filter(s => s.data >= oggi);
  const sessioniPassate = sessioni.filter(s => s.data < oggi);
  const richiesteInAttesa = richieste.filter(r => r.stato === "in_attesa");

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#aaa" }}>Caricamento…</div>;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", paddingBottom: 80, display: "flex", flexDirection: "column", gap: 12 }}>
      {richiesteInAttesa.length > 0 && (
        <Card>
          <SectionLabel>In attesa di conferma</SectionLabel>
          {richiesteInAttesa.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < richiesteInAttesa.length - 1 ? `0.5px solid rgba(0,0,0,0.05)` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.amber, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.tipo}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{formatDataLeggibile(r.data)} · {r.ora_inizio}–{r.ora_fine}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: C.amberLight, color: C.amberDark }}>In attesa</div>
            </div>
          ))}
        </Card>
      )}
      {sessioniFuture.length > 0 && (
        <Card>
          <SectionLabel>Prossime sessioni</SectionLabel>
          {sessioniFuture.map((s, i) => {
            const badge = badgeSessione(s.stato);
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < sessioniFuture.length - 1 ? `0.5px solid rgba(0,0,0,0.05)` : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: TIPO_COLORI[s.tipo] ?? C.orange, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.tipo}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{formatDataLeggibile(s.data)} · {s.ora_inizio}–{s.ora_fine}</div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: badge.bg, color: badge.color }}>{badge.label}</div>
              </div>
            );
          })}
        </Card>
      )}
      {sessioniPassate.length > 0 && (
        <Card>
          <SectionLabel>Storico</SectionLabel>
          {sessioniPassate.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < sessioniPassate.length - 1 ? `0.5px solid rgba(0,0,0,0.05)` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: TIPO_COLORI[s.tipo] ?? "#888", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.tipo}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{formatDataLeggibile(s.data)} · {s.ora_inizio}–{s.ora_fine}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#f0f0f0", color: "#888" }}>Completata</div>
            </div>
          ))}
        </Card>
      )}
      {sessioni.length === 0 && richieste.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>Nessuna sessione ancora</div>
          <div style={{ fontSize: 12, color: "#bbb" }}>Vai su "Prenota" per richiedere la tua prima sessione!</div>
        </div>
      )}
    </div>
  );
}

// ── TAB PROFILO ──
function TabProfilo({ utente, profilo, onLogout, onAggiornaProfilo }: {
  utente: Utente; profilo: Profilo | null;
  onLogout: () => void; onAggiornaProfilo: (p: Profilo) => void;
}) {
  const [nome, setNome]         = useState(profilo?.nome ?? "");
  const [telefono, setTelefono] = useState(profilo?.telefono ?? "");
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast]       = useState(false);

  const handleSalva = async () => {
    setSalvando(true);
    try {
      await aggiornaProfilo(utente.id, { nome, telefono });
      onAggiornaProfilo({ nome, telefono });
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } catch { alert("Errore nel salvataggio. Riprova."); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", paddingBottom: 80, display: "flex", flexDirection: "column", gap: 12 }}>
      {toast && <div style={{ background: C.green, color: "#fff", borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>✓ Profilo aggiornato!</div>}
      <Card>
        <SectionLabel>I tuoi dati</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <SectionLabel>Nome</SectionLabel>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)}
              style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `0.5px solid ${C.border}`, fontSize: 14, boxSizing: "border-box" as const, outline: "none" }} />
          </div>
          <div>
            <SectionLabel>Telefono</SectionLabel>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
              style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `0.5px solid ${C.border}`, fontSize: 14, boxSizing: "border-box" as const, outline: "none" }} />
          </div>
          <div>
            <SectionLabel>Email</SectionLabel>
            <div style={{ padding: "11px 13px", borderRadius: 10, border: `0.5px solid ${C.border}`, fontSize: 14, color: "#aaa", background: "#f9f9f9" }}>{utente.email}</div>
          </div>
          <button onClick={handleSalva} disabled={salvando}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: salvando ? "#ccc" : C.orange, color: "#fff", fontSize: 15, fontWeight: 700, cursor: salvando ? "default" : "pointer" }}>
            {salvando ? "Salvataggio…" : "Salva modifiche"}
          </button>
        </div>
      </Card>
      <Card>
        <SectionLabel>Account</SectionLabel>
        <button onClick={onLogout}
          style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "#FCEBEB", color: "#A32D2D", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Esci dall'account
        </button>
      </Card>
      <div style={{ background: C.orangeLight, borderRadius: 10, padding: "12px 14px", fontSize: 12, color: C.orange, lineHeight: 1.6 }}>
        <strong>Beatcave Studio</strong><br/>
        Per info e assistenza scrivi a <strong>info@beatcavestudio.it</strong>
      </div>
    </div>
  );
}

// ── APP PRINCIPALE ──
export default function App() {
  const [utente, setUtente]   = useState<Utente | null>(null);
  const [profilo, setProfilo] = useState<Profilo | null>(null);
  const [tab, setTab]         = useState<Tab>("prenota");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("bc_utente");
    if (saved) {
      try {
        const u = JSON.parse(saved) as Utente;
        setUtente(u);
        fetchProfilo(u.id).then(p => { if (p) setProfilo(p); }).catch(() => {});
      } catch { localStorage.removeItem("bc_utente"); }
    }
    setLoading(false);
  }, []);

  const handleLogin = (u: Utente) => {
    setUtente(u);
    localStorage.setItem("bc_utente", JSON.stringify(u));
    if (u.id) {
      fetchProfilo(u.id).then(p => { if (p) setProfilo(p); }).catch(() => {});
    }
  };

  const handleLogout = async () => {
    if (utente) await esci(utente.token).catch(() => {});
    setUtente(null);
    setProfilo(null);
    localStorage.removeItem("bc_utente");
  };

  if (loading) return <LoadingScreen />;
  if (!utente) return <SchermatAuth onLogin={handleLogin} />;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "prenota",  label: "Prenota",       icon: "📅" },
    { id: "sessioni", label: "Sessioni",       icon: "🎙" },
    { id: "brani",    label: "I tuoi brani",  icon: "🎵" },
    { id: "profilo",  label: "Profilo",        icon: "👤" },
  ];

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100dvh", background: C.bg, display: "flex", flexDirection: "column", fontFamily: "'SF Pro Text','Helvetica Neue',Arial,sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ background: C.dark, paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", paddingBottom: 14, paddingLeft: 16, paddingRight: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <img src="/logo.png" alt="Beatcave Studio" style={{ height: 26, width: "auto", filter: "brightness(0) invert(1)", display: "block" }} />
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          {profilo?.nome ?? utente.email.split("@")[0]}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {tab === "prenota"  && <TabPrenota  utente={utente} profilo={profilo} />}
        {tab === "sessioni" && <TabSessioni utente={utente} />}
        {tab === "brani"    && <TabBrani    utente={utente} />}
        {tab === "profilo"  && <TabProfilo  utente={utente} profilo={profilo} onLogout={handleLogout} onAggiornaProfilo={setProfilo} />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: `0.5px solid ${C.border}`, display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 0 11px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? C.orange : "#bbb" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
