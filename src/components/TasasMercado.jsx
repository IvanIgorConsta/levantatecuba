import { useEffect, useMemo, useState } from "react";
import { FaFacebook, FaTelegram, FaTwitter, FaWhatsapp } from "react-icons/fa";

/* Formato numérico */
const nf = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseCupCell(raw = "") {
  const s = String(raw || "").replace(/\s+/g, " ").toUpperCase();
  const venta = (s.match(/VENTA\s*([0-9.,]+)/i) || [])[1];
  const compra = (s.match(/COMPRA\s*([0-9.,]+)/i) || [])[1];
  const ventaVar = (s.match(/VENTA[\s0-9.,]*CUP\s*([+\-]?[0-9.,]+)/i) || [])[1];
  const compraVar = (s.match(/COMPRA[\s0-9.,]*CUP\s*([+\-]?[0-9.,]+)/i) || [])[1];
  if (!venta && !compra) {
    const first = (s.match(/([0-9]+[.,]?[0-9]*)/) || [])[1];
    return { venta: first || null, ventaVar: null, compra: null, compraVar: null };
  }
  return { venta, ventaVar, compra, compraVar };
}

/* Ajuste responsive: menos ancho en móvil */
function VarBadge({ val }) {
  const base =
    "inline-block shrink-0 w-10 md:w-14 text-right tabular-nums text-[10px] md:text-[11px]";
  if (!val) return <span className={base}> </span>;
  const n = parseFloat(String(val).replace(",", "."));
  const sign = Number.isFinite(n) ? (n > 0 ? "+" : "") : "";
  const color = Number.isFinite(n)
    ? n > 0
      ? "text-green-400"
      : n < 0
      ? "text-red-400"
      : "text-white/60"
    : "text-white/60";
  return (
    <span className={`${base} ${color}`}>
      {sign}
      {Number.isFinite(n) ? nf.format(Math.abs(n)) : val}
    </span>
  );
}

function Num({ value }) {
  const base = "inline-block w-20 md:w-24 text-right tabular-nums text-[12px] md:text-sm";
  if (!value) return <span className={base}>—</span>;
  const n = parseFloat(String(value).replace(",", "."));
  return <span className={base}>{Number.isFinite(n) ? nf.format(n) : value}</span>;
}

export default function TasasMercado({ sharePath = "/tasas" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    fetch("/api/tasas?maxAge=60")
      .then((r) => {
        if (!r.ok) throw new Error("HTTP");
        return r.json();
      })
      .then((json) => mounted && setData(json))
      .catch(() => mounted && setErr("No se pudieron cargar las tasas."))
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, []);

  const tasasOrdenadas = useMemo(() => {
    const t = Array.isArray(data?.tasas) ? [...data.tasas] : [];
    const hasZelle = t.some((x) => (x.moneda || "").toLowerCase().includes("zelle"));
    if (!hasZelle) {
      const usd = t.find((x) => /\bUSD\b/i.test(x.moneda || ""));
      t.unshift({
        moneda: "Zelle (USD)",
        cup: usd?.cup ?? "—",
        mlc: usd?.mlc ?? "—",
        usd: usd?.usd ?? "—",
        _z: true,
      });
    }
    const p = (m) => {
      const s = (m || "").toUpperCase();
      if (s.includes("ZELLE")) return 0;
      if (/\bUSD\b/.test(s)) return 1;
      if (/\bEUR\b/.test(s)) return 2;
      return 9;
    };
    return t.sort((a, b) => p(a.moneda) - p(b.moneda));
  }, [data]);

  const hasAnyMLC = useMemo(
    () => tasasOrdenadas.some((r) => /\d/.test(r.mlc || "")),
    [tasasOrdenadas]
  );
  const hasAnyUSD = useMemo(
    () => tasasOrdenadas.some((r) => /\d/.test(r.usd || "")),
    [tasasOrdenadas]
  );

  const fechaTexto = useMemo(() => {
    const f = data?.fetchedAt || data?.createdAt;
    return f ? new Date(f).toLocaleString("es-ES") : "";
  }, [data]);

  const shareUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return encodeURIComponent(`${origin}${sharePath}`);
  }, [sharePath]);

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="h-6 w-56 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="h-10 w-full bg-white/10 rounded animate-pulse" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="bg-white/5 border border-red-500/30 rounded-2xl p-4 md:p-5 text-white">
        <div className="text-red-400 text-sm">{err}</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/70 rounded-2xl shadow-lg border border-zinc-800/40 backdrop-blur-md p-4 sm:p-6 md:p-8 text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
          Tasa del mercado informal en Cuba
        </h2>
        <div className="text-[11px] sm:text-xs text-white/60">
          Fuente:{" "}
          <a
            href={
              data?.url ||
              "https://eltoque.com/tasas-de-cambio-de-moneda-en-cuba-hoy"
            }
            target="_blank"
            rel="noopener nofollow"
            className="underline decoration-white/30 hover:decoration-white"
          >
            elTOQUE
          </a>{" "}
          • {fechaTexto || "Actualizando…"}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] sm:text-sm [font-variant-numeric:tabular-nums]">
          <thead className="sticky top-0 z-10 bg-black/50 backdrop-blur border-b border-white/10">
            <tr className="text-white/70">
              <th className="text-left font-semibold py-2 px-2 md:px-3">Moneda</th>
              <th className="text-right font-semibold py-2 px-2 md:px-3">
                Venta (CUP)
              </th>
              <th className="text-right font-semibold py-2 px-2 md:px-3">
                Compra (CUP)
              </th>
              {hasAnyMLC && (
                <th className="text-right font-semibold py-2 px-2 md:px-3">MLC</th>
              )}
              {hasAnyUSD && (
                <th className="text-right font-semibold py-2 px-2 md:px-3">USD</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {tasasOrdenadas.map((t, i) => {
              const isZelle = (t.moneda || "").toLowerCase().includes("zelle");
              const { venta, ventaVar, compra, compraVar } = parseCupCell(t.cup);

              return (
                <tr
                  key={i}
                  className={`hover:bg-white/[0.06] transition ${
                    isZelle ? "bg-yellow-400/5" : ""
                  }`}
                >
                  <td className="py-2 px-2 md:px-3 text-xs sm:text-sm">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] sm:text-xs font-medium
                        ${
                          isZelle
                            ? "bg-yellow-400 text-black"
                            : "bg-white/10 text-white"
                        }`}
                    >
                      {t.moneda}
                    </span>
                  </td>
                  <td className="py-2 px-2 md:px-3">
                    <div className="flex justify-end items-baseline gap-2">
                      <Num value={venta} />
                      <VarBadge val={ventaVar} />
                    </div>
                  </td>
                  <td className="py-2 px-2 md:px-3">
                    <div className="flex justify-end items-baseline gap-2">
                      <Num value={compra} />
                      <VarBadge val={compraVar} />
                    </div>
                  </td>
                  {hasAnyMLC && (
                    <td className="py-2 px-2 md:px-3 text-right tabular-nums">
                      {t.mlc && /\d/.test(t.mlc) ? t.mlc : "—"}
                    </td>
                  )}
                  {hasAnyUSD && (
                    <td className="py-2 px-2 md:px-3 text-right tabular-nums">
                      {t.usd && /\d/.test(t.usd) ? t.usd : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barra de compartir */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex gap-4 text-white text-lg sm:text-xl justify-center md:justify-start">
          <a href={`https://wa.me/?text=${shareUrl}`} target="_blank" rel="noreferrer" className="hover:text-green-400" aria-label="WhatsApp"><FaWhatsapp/></a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noreferrer" className="hover:text-blue-500" aria-label="Facebook"><FaFacebook/></a>
          <a href={`https://twitter.com/intent/tweet?url=${shareUrl}`} target="_blank" rel="noreferrer" className="hover:text-sky-400" aria-label="X/Twitter"><FaTwitter/></a>
          <a href={`https://t.me/share/url?url=${shareUrl}`} target="_blank" rel="noreferrer" className="hover:text-blue-300" aria-label="Telegram"><FaTelegram/></a>
        </div>
      </div>
    </div>
  );
}
