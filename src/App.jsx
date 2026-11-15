import { useEffect, useRef, useState } from "react";

const API = (import.meta.env.VITE_API || "").replace(/\/$/, "");
const tg = window.Telegram?.WebApp;
const SITES = ["YouTube", "YT Music", "TikTok", "Douyin", "Facebook", "VK", "Weibo", "Red Note"];
const hap = (t) => { try { tg.HapticFeedback.notificationOccurred(t); } catch {} };

const BTN = "w-full rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 px-4 py-3.5 font-bold text-white shadow-lg shadow-violet-500/30 transition active:scale-95 disabled:opacity-40 disabled:shadow-none";
const GHOST = "whitespace-nowrap rounded-2xl bg-slate-200 px-4 py-3.5 font-semibold dark:bg-white/10";
const CARD = "flex animate-up flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-white/10 dark:bg-white/5 dark:backdrop-blur";

async function api(path, body) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 100000);
  try {
    const r = await fetch(API + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "X-Init-Data": tg?.initData || "" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const d = await r.json().catch(() => ({ error: "Server error" }));
    if (!r.ok) throw new Error(d.error || "Error");
    return d;
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "ဆာဗာ မဖြေပါ၊ ခဏနေ ထပ်စမ်းပါ" : e.message);
  } finally { clearTimeout(to); }
}

const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");
const size = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

function Ring({ pct, spin }) {
  const C = 2 * Math.PI * 44;
  return (
    <div className="relative size-28">
      <svg viewBox="0 0 100 100" className={"size-full -rotate-90 fill-none [stroke-width:7] [stroke-linecap:round]" + (spin ? " animate-spin" : "")}>
        <circle cx="50" cy="50" r="44" className="stroke-slate-200 dark:stroke-white/10" />
        <circle cx="50" cy="50" r="44" className="stroke-sky-400 transition-[stroke-dashoffset] duration-500"
          strokeDasharray={C} strokeDashoffset={spin ? C * 0.72 : C * (1 - pct / 100)} />
      </svg>
      <output className="absolute inset-0 grid place-items-center font-display text-xl font-bold">{spin ? "…" : pct + "%"}</output>
    </div>
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState("video");
  const [q, setQ] = useState(720);
  const [phase, setPhase] = useState("idle"); // idle | checking | ready | busy | done
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [res, setRes] = useState(null);
  const [toast, setToast] = useState("");
  const timer = useRef();
  const toastT = useRef();

  const say = (m) => {
    setToast(m); hap("error");
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 4500);
  };

  useEffect(() => {
    tg?.ready(); tg?.expand();
    document.documentElement.classList.toggle("dark", (tg?.colorScheme || "dark") === "dark");
    fetch(API + "/api/ping").catch(() => {});
    return () => clearInterval(timer.current);
  }, []);

  // Media Session API: lock-screen controls နဲ့ သီချင်းအချက်အလက်
  useEffect(() => {
    if (res && mode === "audio" && "mediaSession" in navigator && info) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: info.title, artist: info.uploader || "",
        artwork: info.thumbnail ? [{ src: info.thumbnail }] : [],
      });
    }
  }, [res, mode, info]);

  if (!tg?.initData) {
    return (
      <main className="grid min-h-dvh place-content-center gap-2 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 font-display text-2xl font-bold text-white">Z</div>
        <h1 className="mt-2 text-xl font-bold">Telegram ထဲကနေပဲ ဖွင့်ပါ</h1>
        <p className="text-slate-500 dark:text-violet-200/60">Bot ရဲ့ Menu ခလုတ်ကနေ ဝင်သုံးပါ</p>
      </main>
    );
  }

  const reset = () => { setInfo(null); setRes(null); setPhase("idle"); };
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { setUrl(t.trim()); reset(); } }
    catch { say("Clipboard ကို ဖတ်ခွင့်မရပါ၊ ကိုယ်တိုင် paste လုပ်ပါ"); }
  };

  const check = async (e) => {
    e?.preventDefault();
    const u = url.trim();
    if (!u || phase === "checking") return;
    setPhase("checking"); setInfo(null); setRes(null);
    try {
      const d = await api("/api/info", { url: u });
      const qs = d.qualities || [];
      setInfo(d);
      setMode(d.kind === "song" ? "audio" : "video");
      setQ(qs.includes(720) ? 720 : qs[qs.length - 1] || 720);
      setPhase("ready");
    } catch (err) { setPhase("idle"); say(err.message); }
  };

  const save = (file, name) => {
    const full = API + file;
    if (tg.isVersionAtLeast?.("8.0") && typeof tg.downloadFile === "function") {
      tg.downloadFile({ url: full, file_name: name }, (ok) => { if (!ok) say("Download ကို ပယ်ဖျက်လိုက်တယ်"); });
    } else tg.openLink(full);
  };

  const start = async () => {
    setPhase("busy"); setPct(0); setLabel("စတင်နေတယ်");
    try {
      const { job } = await api("/api/prepare", { url: url.trim(), mode, quality: q });
      let fails = 0;
      timer.current = setInterval(async () => {
        try {
          const s = await api("/api/status/" + job);
          fails = 0;
          if (s.state === "queued") setLabel("တန်းစီနေတယ်");
          else if (s.state === "downloading") { setLabel("ဆွဲနေတယ်"); setPct(s.progress); }
          else if (s.state === "processing") setLabel("ပြင်ဆင်နေတယ်");
          else if (s.state === "done") {
            clearInterval(timer.current); setRes(s); setPhase("done"); hap("success"); save(s.file, s.name);
          } else if (s.state === "error") {
            clearInterval(timer.current); setPhase("ready"); say(s.error || "Download မအောင်မြင်ပါ");
          }
        } catch (err) {
          if (++fails >= 5) { clearInterval(timer.current); setPhase("ready"); say(err.message); }
        }
      }, 1200);
    } catch (err) { setPhase("ready"); say(err.message); }
  };

  const busy = phase === "busy";
  const qs = info?.qualities || [];
  const tab = (on) => "flex-1 rounded-xl py-2.5 font-semibold transition " +
    (on ? "bg-white shadow dark:bg-white/15" : "text-slate-500 dark:text-violet-200/60");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 font-display text-xl font-bold text-white shadow-lg shadow-violet-500/40">Z</div>
        <div>
          <h1 className="font-display text-xl font-bold leading-tight">Zaibuzai</h1>
          <p className="text-sm text-slate-500 dark:text-violet-200/60">link ထည့် · ဖုန်းထဲ တန်းသိမ်း</p>
        </div>
      </header>

      <form onSubmit={check} className="flex flex-col gap-3">
        <div className="relative">
          <input
            type="url" required value={url} disabled={busy} enterKeyHint="go" autoComplete="off" spellCheck="false"
            placeholder="Link ကို ဒီမှာ paste လုပ်ပါ"
            onChange={(e) => { setUrl(e.target.value); if (info) reset(); }}
            className="w-full rounded-2xl border-2 border-slate-200 bg-white py-4 pl-4 pr-24 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 dark:border-white/10 dark:bg-white/5"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
            {url ? (
              <button type="button" aria-label="ဖျက်မယ်" disabled={busy} onClick={() => { setUrl(""); reset(); }} className="size-9 rounded-full text-slate-400">✕</button>
            ) : (
              <button type="button" onClick={paste} className="rounded-xl bg-sky-400/15 px-3 py-1.5 text-sm font-semibold text-sky-500">Paste</button>
            )}
          </div>
        </div>
        {!["ready", "busy", "done"].includes(phase) && (
          <button type="submit" disabled={!url.trim() || phase === "checking"} className={BTN}>
            {phase === "checking" ? "စစ်နေတယ်…" : "စစ်မယ်"}
          </button>
        )}
      </form>

      {phase === "idle" && (
        <ul className="flex flex-wrap justify-center gap-2">
          {SITES.map((s) => (
            <li key={s} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-violet-200/70">{s}</li>
          ))}
        </ul>
      )}

      {info && (
        <article className={CARD}>
          <figure className="relative m-0 aspect-video overflow-hidden rounded-2xl bg-slate-200 dark:bg-white/10">
            {info.thumbnail
              ? <img src={info.thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover" />
              : <div className="grid size-full place-items-center text-5xl opacity-50">♪</div>}
            {info.duration ? <time className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-0.5 text-xs text-white">{dur(info.duration)}</time> : null}
          </figure>
          <h2 className="line-clamp-2 font-semibold leading-snug">{info.title}</h2>
          {info.uploader && <p className="-mt-2 text-sm text-slate-500 dark:text-violet-200/60">{info.uploader}</p>}

          {!busy && phase !== "done" && (
            <>
              <div role="tablist" className="flex rounded-2xl bg-slate-200 p-1 dark:bg-white/10">
                {info.kind !== "song" && <button role="tab" aria-selected={mode === "video"} className={tab(mode === "video")} onClick={() => setMode("video")}>🎬 Video</button>}
                <button role="tab" aria-selected={mode === "audio"} className={tab(mode === "audio")} onClick={() => setMode("audio")}>🎵 MP3</button>
              </div>
              {mode === "video" && qs.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {qs.map((v) => (
                    <button key={v} onClick={() => setQ(v)}
                      className={"rounded-full border-2 px-4 py-1.5 font-semibold transition " + (q === v ? "border-sky-400 bg-sky-400/10 text-sky-500" : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-violet-200/60")}>
                      {v}p
                    </button>
                  ))}
                </div>
              )}
              <button className={BTN} onClick={start}>⬇ ဒေါင်းမယ်</button>
            </>
          )}

          {busy && (
            <div className="flex flex-col items-center gap-1 py-2" aria-live="polite">
              <Ring pct={pct} spin={label !== "ဆွဲနေတယ်"} />
              <p className="text-slate-500 dark:text-violet-200/60">{label}</p>
            </div>
          )}

          {phase === "done" && res && (
            <div className="flex animate-up flex-col gap-2.5">
              <p className="font-bold text-emerald-500">✓ ပြီးပါပြီ</p>
              <p className="break-all text-sm text-slate-500 dark:text-violet-200/60">{res.name} · {size(res.size)}</p>
              {mode === "audio"
                ? <audio controls preload="metadata" src={API + res.file} className="w-full" />
                : <video controls playsInline preload="metadata" poster={info.thumbnail} src={API + res.file} className="max-h-[46vh] w-full rounded-2xl bg-black" />}
              <div className="flex gap-2.5">
                <button className={BTN} onClick={() => save(res.file, res.name)}>⬇ ပြန်သိမ်းမယ်</button>
                <button className={GHOST} onClick={() => { setUrl(""); reset(); }}>နောက်တစ်ခု</button>
              </div>
            </div>
          )}
        </article>
      )}

      <div role="status" aria-live="assertive"
        className={"pointer-events-none fixed bottom-6 left-1/2 max-w-[90%] -translate-x-1/2 rounded-2xl bg-red-500 px-4 py-3 text-sm text-white shadow-xl transition duration-300 " + (toast ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
        {toast}
      </div>
    </main>
  );
}
