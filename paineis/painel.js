/* paineis/painel.js — Relatórios FDB · conteúdo comum dos painéis de tela única.
 * @version 1.0.0
 *   1.0.0 - 2026-11-13 - Primeira versão: indicadores, painéis, tabela compacta de vendas,
 *                        detalhe da venda, abas do celular e o menu Tema (painéis e temas clássicos).
 * Histórico completo das versões: CHANGELOG.md no repositório.
 * Usa o motor (ENG) para os dados reais e o ao vivo. Cada tema só posiciona e estiliza os blocos
 * (ids): #kpis, #tipos, #pagtos, #caixas, #horas, #produtos, #conv, #vends, #cab, #feed, #rod,
 * #filtros, os botões [data-aba] e o botão #btnTema. */
(function(){
  "use strict";
  const cfg = window.PAINEL_CFG || {};
  const COR = Object.assign({"Gerencial": "#f59e0b", "NFC-e": "#3b82f6", "NF-e": "#8b5cf6", "Recebimento": "#14b8a6"}, cfg.cores || {});
  const SIG = {"Gerencial": "GER", "NFC-e": "NFC-e", "NF-e": "NF-e", "Recebimento": "REC"};
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const ext = {pg: null, cx: null}; let ignora = null;          // filtros extras (forma de pagamento e caixa)
  const ord = {k: "hora", d: -1};                               // ordenação da tabela
  const E = () => window.ENG;
  const num = v => Number(v || 0).toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const int = v => Math.round(Number(v) || 0).toLocaleString("pt-BR");
  const pct = (a, b) => b ? (a / b * 100) : 0;
  const pctTxt = p => (Math.round(p * 10) / 10).toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1}) + "%";
  const qtd = q => (Math.round(Number(q) * 1000) / 1000).toLocaleString("pt-BR");

  // ── Formas de pagamento (nomes padronizados) ────────────────────────────────
  const NOMES = {PIX: "Pix", DINHEIRO: "Dinheiro", CREDITO: "Crédito", DEBITO: "Débito", BOLETO: "Boleto", CHEQUE: "Cheque", PRAZO: "A prazo", CREDIARIO: "Crediário", VALE: "Vale"};
  function nomeForma(k){
    const n = E().norm(k).toUpperCase().replace(/^\d+\s*/, "").replace(/\s+/g, " ").trim();
    for (const c of Object.keys(NOMES)) if (n.includes(c)) return NOMES[c];
    const t = String(k || "").replace(/^\d+\s*/, "").trim().toLowerCase();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Outros";
  }
  function formasDe(x){
    const out = new Map(), fv = x.fv || {};
    Object.keys(fv).forEach(k => { const v = Number(fv[k]) || 0, n = nomeForma(k); out.set(n, (out.get(n) || 0) + v); });
    if (!out.size) { const ps = String(x.pg || "").split(/[,/+;]| e /).map(s => s.trim()).filter(Boolean);
      if (ps.length === 1) out.set(nomeForma(ps[0]), x.tot); else if (ps.length) ps.forEach(p => out.set(nomeForma(p), null)); else out.set("Não informado", x.tot); }
    return Array.from(out, ([k, v]) => ({k, v}));
  }
  const vendaMin = x => { const p = String(x.seg || x.h).split(":").map(Number); return (p[0] || 0) * 60 + (p[1] || 0); };

  // ── Lista com os filtros atuais (opcionalmente ignorando um filtro extra) ───
  function lista(semFiltro){ ignora = semFiltro || null; try { return E().filtradas(); } finally { ignora = null; } }

  // ── Esqueletos (montados uma vez, antes do primeiro desenho) ────────────────
  const COLS = [["hora", "Hora"], ["tipo", "Tipo"], ["numero", "Nº"], ["caixa", "Cx"], ["vendedor", "Vendedor"], ["cliente", "Cliente / natureza"], ["itens", "Itens"], ["pag", "Pagamento"], ["total", "Total"]];
  function esqueletos(){
    const k = $("#kpis");
    if (k) k.innerHTML = [
      ["Total vendido", '<b data-n="total"></b>', '<span data-n="qt"></span>'],
      ["Ticket médio", '<b data-n="ticket"></b>', '<span id="k-tk2"></span>'],
      ["Itens vendidos", '<b id="k-it"></b>', '<span id="k-it2"></span>'],
      ["Maior venda", '<b id="k-mx"></b>', '<span id="k-mx2"></span>'],
      ["Média por hora", '<b id="k-hr"></b>', '<span id="k-hr2"></span>'],
      ["Última venda", '<b id="k-ul"></b>', '<span id="k-ul2"></span>'],
      ["Documento fiscal", '<b id="k-fi"></b>', '<span id="k-fi2"></span>']
    ].map(([t, b, s], i) => `<div class="kp kp${i + 1}"><small>${t}</small>${b}${s}</div>`).join("");
    const c = $("#cab");
    if (c) c.innerHTML = COLS.map(([k2, t]) => k2 === "pag" ? `<span class="c-${k2}">${t}</span>` : `<button type="button" class="c-${k2}" data-ord="${k2}">${t}<i></i></button>`).join("");
    marcaOrd();
  }
  function marcaOrd(){ $$("[data-ord]").forEach(b => { const on = b.dataset.ord === ord.k; b.classList.toggle("on", on); const i = b.querySelector("i"); if (i) i.textContent = on ? (ord.d < 0 ? "▼" : "▲") : ""; }); }

  // ── Linha da tabela ─────────────────────────────────────────────────────────
  function card(x){
    const en = E(), es = en.esc, q = x.itens.reduce((s, i) => s + (Number(i.q) || 0), 0);
    const it = x.itens.map(i => qtd(i.q) + "× " + i.d).join(" · ");
    const fs = formasDe(x);
    const cli = x.cli || x.nat || "";
    return `<div class="lv${x.novo ? " novo" : ""}${x.rec ? " rec" : ""}" style="--c:${COR[x.t] || "#94a3b8"}">` +
      `<span class="c-hora mn">${es(x.seg || x.h)}</span>` +
      `<span class="c-tipo"><i class="tg">${es(SIG[x.t] || x.t)}</i></span>` +
      `<span class="c-numero mn">${es(x.n)}</span>` +
      `<span class="c-caixa mn">${es(x.cx || "—")}</span>` +
      `<span class="c-vendedor" title="${es(x.vend)}">${es(x.vend)}</span>` +
      `<span class="c-cliente${cli ? "" : " vz"}" title="${es(cli)}">${es(cli || "—")}</span>` +
      `<span class="c-itens" title="${es(it)}"><b class="mn">${qtd(q)}</b>${es(it || "—")}</span>` +
      `<span class="c-pag">${fs.map(f => `<i title="${es(f.k)}${f.v != null ? " · " + es(en.fmt(f.v)) : ""}">${es(f.k)}${f.v != null && fs.length > 1 ? " <em class='mn'>" + num(f.v) + "</em>" : ""}</i>`).join("")}</span>` +
      `<span class="c-total mn">${num(x.tot)}</span></div>`;
  }

  // ── Vendedor (linha do ranking) ─────────────────────────────────────────────
  const AV = ["#e542a3", "#1f7aec", "#d16b00", "#00a884", "#7f66ff", "#c4532c", "#027eb5", "#a62c71", "#0f766e", "#b45309"];
  const corAv = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
  const iniciais = s => { const p = String(s || "").replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean); return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : (p[0] || "?").slice(0, 2)).toUpperCase(); };
  let porVend = {};
  function calcVend(){
    porVend = {};
    const tp = E().st.tipo; // mesma base do ranking do motor (só o filtro de tipo)
    E().vendas.filter(x => tp === "todos" || x.t === tp).forEach(x => { const o = porVend[x.vend] || (porVend[x.vend] = {}); o[x.t] = (o[x.t] || 0) + x.tot; });
  }
  function vend(v, on, tot, k){
    if (k === -1) calcVend();
    const en = E(), es = en.esc, p = v.v ? pct(v.tot, tot) : 100, tk = v.q ? v.tot / v.q : 0;
    const sp = v.v ? (porVend[v.v] || {}) : null;
    const barra = sp ? en.T.concat(["Recebimento"]).filter(t => sp[t]).map(t => `<i style="width:${pct(sp[t], v.tot || 1).toFixed(2)}%;background:${COR[t]}" title="${t}: ${es(en.fmt(sp[t]))}"></i>`).join("") : `<i style="width:100%"></i>`;
    return `<div class="vd${on ? " on" : ""}" data-vend="${v.v ? es(v.v) : ""}" title="${v.v ? es(v.v) : "Todos os vendedores"}">` +
      `<span class="vd-r mn">${v.v ? k + 1 : "∑"}</span><span class="vd-av" style="--av:${v.v ? corAv(v.v) : "var(--ac)"}">${v.v ? es(iniciais(v.v)) : "∑"}</span><span class="vd-n">${v.v ? es(v.v) : "Todos"}</span>` +
      `<span class="vd-t mn">${num(v.tot)}</span><span class="vd-p mn">${v.v ? pctTxt(p) : "100%"}</span>` +
      `<span class="vd-s">${en.pl(v.q)} · ticket <b class="mn">${num(tk)}</b></span><span class="vd-b">${barra}</span></div>`;
  }

  // ── Painéis ─────────────────────────────────────────────────────────────────
  function barraLinha(attr, on, cor, nome, q, tot, p, extra){
    return `<div class="br${on ? " on" : ""}"${attr} style="--c:${cor}"><span class="br-n">${nome}</span><span class="br-q mn">${q}</span><span class="br-t mn">${num(tot)}</span><span class="br-p mn">${pctTxt(p)}</span><span class="br-b"><i style="width:${Math.max(0, Math.min(100, p)).toFixed(2)}%"></i></span>${extra || ""}</div>`;
  }
  function pTipos(l){
    const el = $("#tipos"); if (!el) return; const en = E(), tot = l.reduce((s, x) => s + x.tot, 0), g = {};
    l.forEach(x => { const o = g[x.t] || (g[x.t] = {q: 0, t: 0}); o.q++; o.t += x.tot; });
    const tipos = en.T.concat(Object.keys(g).filter(t => !en.T.includes(t)));
    el.innerHTML = tipos.map(t => { const o = g[t] || {q: 0, t: 0};
      return barraLinha(` data-tipo="${en.esc(t)}"`, en.st.tipo === t, COR[t] || "#94a3b8", en.esc(t), o.q, o.t, pct(o.t, tot)); }).join("");
  }
  function pPagtos(){
    const el = $("#pagtos"); if (!el) return; const l = lista("pg"), g = new Map(); let tot = 0, semValor = 0;
    l.forEach(x => formasDe(x).forEach(f => { const o = g.get(f.k) || {q: 0, t: 0}; o.q++; if (f.v != null) { o.t += f.v; tot += f.v; } else semValor++; g.set(f.k, o); }));
    const arr = Array.from(g, ([k, o]) => ({k, ...o})).sort((a, b) => b.t - a.t || b.q - a.q);
    const PAL = cfg.paleta || ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];
    el.innerHTML = arr.length ? arr.map((o, i) => barraLinha(` data-pg="${E().esc(o.k)}" title="Filtrar: ${E().esc(o.k)}"`, ext.pg === o.k, PAL[i % PAL.length], E().esc(o.k), o.q, o.t, pct(o.t, tot))).join("") +
      (semValor ? `<div class="obs">${semValor} pagamento(s) com várias formas sem o valor de cada uma.</div>` : "") : `<div class="obs">Sem pagamentos.</div>`;
  }
  function pCaixas(){
    const el = $("#caixas"); if (!el) return; const l = lista("cx"), g = {}; let tot = 0;
    l.forEach(x => { const k = x.cx || "—"; const o = g[k] || (g[k] = {q: 0, t: 0}); o.q++; o.t += x.tot; tot += x.tot; });
    const arr = Object.keys(g).sort().map(k => ({k, ...g[k]}));
    el.innerHTML = arr.length ? arr.map(o => barraLinha(` data-cx="${E().esc(o.k)}" title="Filtrar: caixa ${E().esc(o.k)}"`, ext.cx === o.k, cfg.corCaixa || "#64748b", "Caixa " + E().esc(o.k), o.q, o.t, pct(o.t, tot))).join("") : `<div class="obs">Sem vendas.</div>`;
  }
  function pHoras(l){
    const el = $("#horas"); if (!el) return; const en = E(), hs = en.resumo(en.vendas).horas, g = {};
    l.forEach(x => { const h = x.h.slice(0, 2); const o = g[h] || (g[h] = {}); o[x.t] = (o[x.t] || 0) + x.tot; o._ = (o._ || 0) + x.tot; o.q = (o.q || 0) + 1; });
    const mx = Math.max(1, ...hs.map(h => (g[h] || {})._ || 0)), agora = String(new Date().getHours()).padStart(2, "0");
    let pico = null; hs.forEach(h => { if (g[h] && (!pico || g[h]._ > g[pico]._)) pico = h; });
    el.innerHTML = `<div class="hr-g">${hs.map(h => { const o = g[h] || {};
      const seg = en.T.concat(["Recebimento"]).filter(t => o[t]).map(t => `<i style="height:${(o[t] / mx * 100).toFixed(2)}%;background:${COR[t]}"></i>`).join("");
      return `<div class="hr-c${h === agora ? " ag" : ""}${h === pico ? " pk" : ""}" title="${h}h · ${o.q || 0} venda(s) · ${en.esc(en.fmt(o._ || 0))}"><div class="hr-s">${seg}</div><small>${h}</small></div>`; }).join("")}</div>` +
      `<div class="hr-l">${pico ? `Pico: <b>${pico}h</b> · <b class="mn">${num(g[pico]._)}</b> em ${g[pico].q} venda(s)` : "Sem vendas no período."}</div>`;
  }
  function pProdutos(l){
    const el = $("#produtos"); if (!el) return; const g = new Map();
    l.forEach(x => x.itens.forEach(i => { const k = String(i.d || "").trim() || "(sem descrição)"; const o = g.get(k) || {q: 0, t: 0, semT: false}; o.q += Number(i.q) || 0; if (i.tot != null) o.t += i.tot; else o.semT = true; g.set(k, o); }));
    const arr = Array.from(g, ([k, o]) => ({k, ...o})).sort((a, b) => b.t - a.t || b.q - a.q).slice(0, cfg.topProdutos || 12), mx = Math.max(1, ...arr.map(o => o.t || 0));
    el.innerHTML = arr.length ? arr.map((o, i) => `<div class="pd" title="${E().esc(o.k)}"><span class="pd-r mn">${i + 1}</span><span class="pd-n">${E().esc(o.k)}</span><span class="pd-q mn">${qtd(o.q)} un</span><span class="pd-t mn">${o.t ? num(o.t) : "—"}</span><span class="pd-b"><i style="width:${(o.t / mx * 100).toFixed(2)}%"></i></span></div>`).join("") : `<div class="obs">Sem itens.</div>`;
  }
  function pConv(){
    const el = $("#conv"); if (!el) return; const en = E(), d = (en.dados && en.dados.duplicatas) || {}, cf = Array.isArray(d.confirmadas) ? d.confirmadas : [], pv = Array.isArray(d.provaveis) ? d.provaveis : [];
    const lin = (o, tipo) => `<div class="cv ${tipo}"><span class="mn">${en.esc(String(o.hora || "").slice(0, 5) || "—")}</span><span>Gerencial <b class="mn">${en.esc(o.gerencial || "—")}</b> → ${o.docNumero ? (Number(o.docModelo) === 55 ? "NF-e" : "NFC-e") + ` <b class="mn">${en.esc(o.docNumero)}</b>` : "documento fiscal"}</span><span class="mn">${o.total != null ? num(o.total) : ""}</span><em>${tipo === "cf" ? "confirmada" : "provável"}</em></div>`;
    const n = cf.length + pv.length, cont = $("#conv-n"); if (cont) cont.textContent = n ? String(n) : "";
    el.innerHTML = n ? cf.map(o => lin(o, "cf")).join("") + pv.map(o => lin(o, "pv")).join("") : `<div class="obs">Nenhuma gerencial convertida em nota hoje (nada contado em dobro).</div>`;
  }
  function pKpis(l){
    const en = E(); if (!$("#kpis")) return;
    const it = l.reduce((s, x) => s + x.itens.reduce((a, i) => a + (Number(i.q) || 0), 0), 0), tot = l.reduce((s, x) => s + x.tot, 0);
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    en.numero($("#k-it"), it, v => qtd(Math.round(v * 1000) / 1000)); set("#k-it2", l.length ? qtd(Math.round(it / l.length * 10) / 10) + " por venda" : "—");
    set("#k-tk2", l.length ? "em " + en.pl(l.length) : "—");
    const mx = l.reduce((m, x) => !m || x.tot > m.tot ? x : m, null);
    en.numero($("#k-mx"), mx ? mx.tot : 0); set("#k-mx2", mx ? mx.vend + " · " + mx.h : "—");
    const hs = new Set(l.map(x => x.h.slice(0, 2))).size;
    en.numero($("#k-hr"), hs ? tot / hs : 0); set("#k-hr2", hs ? (l.length / hs).toLocaleString("pt-BR", {maximumFractionDigits: 1}) + " vendas/h em " + hs + " h" : "—");
    const fi = l.filter(x => x.t === "NFC-e" || x.t === "NF-e").reduce((s, x) => s + x.tot, 0);
    set("#k-fi", pctTxt(pct(fi, tot))); set("#k-fi2", en.fmt(fi));
    ultima();
  }
  function ultima(){
    const en = E(), v = en.vendas[0], b = $("#k-ul"), s = $("#k-ul2"); if (!b) return;
    if (!v) { b.textContent = "—"; if (s) s.textContent = "nenhuma ainda"; return; }
    const hoje = en.dados && en.dados.data, d = new Date(), iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const m = d.getHours() * 60 + d.getMinutes() - vendaMin(v);
    b.textContent = hoje && hoje !== iso ? v.h : m < 1 ? "agora" : m < 60 ? "há " + m + " min" : "há " + Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0");
    if (s) s.textContent = v.vend + " · " + en.fmt(v.tot);
  }
  function pRodape(lst){
    const en = E(), es = en.esc, tot = lst.reduce((s, x) => s + x.tot, 0), r = $("#rod");
    if (r) r.innerHTML = `<span><b class="mn">${lst.length}</b> ${lst.length === 1 ? "venda" : "vendas"} na lista</span><span>Soma <b class="mn">${es(en.fmt(tot))}</b></span><span>Ticket <b class="mn">${es(en.fmt(lst.length ? tot / lst.length : 0))}</b></span><span class="rod-at">Atualizado às <b class="mn" id="rod-h"></b></span>`;
    const h = $("#rod-h"); if (h) { const t = en.dados && en.dados.gerado_ts ? new Date(en.dados.gerado_ts) : new Date(); h.textContent = t.toLocaleTimeString("pt-BR"); }
    const f = $("#filtros"); if (!f) return; const ch = [];
    if (en.st.tipo !== "todos") ch.push(["tipo", "Tipo: " + en.st.tipo]);
    if (en.st.vend) ch.push(["vend", "Vendedor: " + en.st.vend]);
    if (ext.pg) ch.push(["pg", "Pagamento: " + ext.pg]);
    if (ext.cx) ch.push(["cx", "Caixa " + ext.cx]);
    if (en.st.q.trim()) ch.push(["q", "Busca: " + en.st.q.trim()]);
    f.innerHTML = ch.length ? ch.map(([k, t]) => `<button type="button" data-limpa="${k}" title="Remover este filtro">${es(t)} <b>×</b></button>`).join("") + (ch.length > 1 ? `<button type="button" data-limpa="tudo">Limpar tudo</button>` : "") : "";
    f.classList.toggle("vazio", !ch.length);
  }

  // ── Detalhe da venda ────────────────────────────────────────────────────────
  function detail(x){
    const en = E(), es = en.esc, fs = formasDe(x), q = x.itens.reduce((s, i) => s + (Number(i.q) || 0), 0);
    const info = [["Tipo", x.t], ["Número", x.n], ["Caixa", x.cx || "—"], ["Hora", x.seg || x.h], ["Vendedor", x.vend], ["Cliente", x.cli || "—"], ["Natureza", x.nat || "—"], ["Itens", qtd(q) + " un em " + x.itens.length + " linha(s)"]];
    return `<div class="dt-k" style="--c:${COR[x.t] || "#94a3b8"}"><i class="tg">${es(SIG[x.t] || x.t)}</i> Nº ${es(x.n)} · ${es(x.seg || x.h)}</div><h2 class="mn">${es(en.fmt(x.tot))}</h2>` +
      `<div class="dt-g">${info.map(([a, b]) => `<div><small>${a}</small><span>${es(b)}</span></div>`).join("")}</div>` +
      `<div class="dt-s">Itens</div><div class="dt-t">${x.itens.length ? x.itens.map(i => `<div><span class="mn">${qtd(i.q)}×</span><span>${es(i.d)}</span><b class="mn">${i.tot != null ? num(i.tot) : "—"}</b></div>`).join("") : `<div><span></span><span>Sem itens.</span><b></b></div>`}</div>` +
      `<div class="dt-s">Pagamento</div><div class="dt-t">${fs.map(f => `<div><span></span><span>${es(f.k)}</span><b class="mn">${f.v != null ? num(f.v) : "—"}</b></div>`).join("")}<div class="dt-tot"><span></span><span>Total</span><b class="mn">${num(x.tot)}</b></div></div>`;
  }

  // ── Ordenação e filtros extras ──────────────────────────────────────────────
  function ordenar(l){
    const k = ord.k, d = ord.d, nq = x => x.itens.reduce((s, i) => s + (Number(i.q) || 0), 0);
    const val = {hora: x => x.seg, total: x => x.tot, vendedor: x => x.vend, tipo: x => x.t, numero: x => Number(x.n) || 0, caixa: x => x.cx, cliente: x => x.cli || x.nat, itens: nq}[k] || (x => x.seg);
    return l.sort((a, b) => { const A = val(a), B = val(b); const c = typeof A === "number" && typeof B === "number" ? A - B : String(A).localeCompare(String(B), "pt-BR"); return c ? c * d : (a.seg < b.seg ? 1 : -1); });
  }
  function filtroExtra(x){
    if (ext.pg && ignora !== "pg" && !formasDe(x).some(f => f.k === ext.pg)) return false;
    if (ext.cx && ignora !== "cx" && (x.cx || "—") !== ext.cx) return false;
    return true;
  }

  // ── Interação ───────────────────────────────────────────────────────────────
  function aba(n){ document.body.dataset.aba = n; $$("[data-aba]").forEach(b => b.classList.toggle("on", b.dataset.aba === n)); try { sessionStorage.setItem("fdb_aba", n); } catch (e) {} }
  function intro(){
    esqueletos(); temaInit();
    let a = "vendas"; try { a = sessionStorage.getItem("fdb_aba") || "vendas"; } catch (e) {}
    if (!["resumo", "vendas", "pagtos", "equipe"].includes(a)) a = "vendas"; aba(a);
    document.addEventListener("click", e => {
      const o = e.target.closest("[data-ord]"); if (o) { const k = o.dataset.ord; if (ord.k === k) ord.d = -ord.d; else { ord.k = k; ord.d = (k === "vendedor" || k === "tipo" || k === "cliente") ? 1 : -1; } marcaOrd(); E().render(); return; }
      const p = e.target.closest("[data-pg]"); if (p) { ext.pg = ext.pg === p.dataset.pg ? null : p.dataset.pg; E().render(); return; }
      const c = e.target.closest("[data-cx]"); if (c) { ext.cx = ext.cx === c.dataset.cx ? null : c.dataset.cx; E().render(); return; }
      const ab = e.target.closest("[data-aba]"); if (ab) { aba(ab.dataset.aba); return; }
      const l = e.target.closest("[data-limpa]"); if (l) { const k = l.dataset.limpa, q = $("#q");
        if (k === "tipo" || k === "tudo") { const b = $('[data-tipo="todos"]'); if (b) b.click(); }
        if (k === "vend" || k === "tudo") { const b = $('#vends [data-vend=""]'); if (b) b.click(); else E().st.vend = null; }
        if (k === "pg" || k === "tudo") ext.pg = null;
        if (k === "cx" || k === "tudo") ext.cx = null;
        if ((k === "q" || k === "tudo") && q) { q.value = ""; E().st.q = ""; }
        E().render(); }
    });
    // Teclado: ↑ ↓ escolhem a linha, Enter abre, / vai para a busca, Esc limpa a busca.
    let sel = -1; const linhas = () => $$("#feed .lv:not([data-saindo])");
    document.addEventListener("keydown", e => {
      if ($("#ov.on") || (menu && menu.classList.contains("on"))) return; const q = $("#q");
      if (e.key === "/" && document.activeElement !== q && q) { e.preventDefault(); q.focus(); q.select(); return; }
      if (e.key === "Escape" && document.activeElement === q && q.value) { q.value = ""; E().st.q = ""; E().render(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      const r = linhas(); if (!r.length) return;
      if (e.key === "Enter") { if (sel >= 0 && r[sel] && document.activeElement !== q) { e.preventDefault(); r[sel].click(); } return; }
      e.preventDefault(); sel = Math.max(0, Math.min(r.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
      r.forEach((x, i) => x.classList.toggle("sel", i === sel)); r[sel].scrollIntoView({block: "nearest"});
    });
    setInterval(ultima, 30000);
  }
  function after(){
    const l = lista(); pKpis(l); pTipos(l); pPagtos(); pCaixas(); pHoras(l); pProdutos(l); pConv(); pRodape(l);
    if (cfg.after) cfg.after(l);
  }
  // ── Menu Tema: duas categorias (painéis de tela única e temas clássicos) ─────
  // A lista vem do servidor (window.FDB_TEMAS): paineis/temas.json + temas clássicos do gerador.
  // Escolher um painel salva "fdb_painel" (o relatório "/" passa a abrir nele); escolher um tema
  // clássico salva "fdb_theme", apaga "fdb_painel" e volta ao relatório clássico.
  const TM = (function(){ const t = window.FDB_TEMAS || {}; return {atual: String(t.atual || ""), paineis: Array.isArray(t.paineis) ? t.paineis : [], classicos: Array.isArray(t.classicos) ? t.classicos : []}; })();
  const cookie = (k, v, s) => { try { document.cookie = k + "=" + encodeURIComponent(v) + ";path=/;max-age=" + s + ";SameSite=Strict"; } catch (e) {} };
  const fonte = () => (E() && E().FONTE) || "/";
  const consulta = () => { const f = fonte(), i = f.indexOf("?"); return i >= 0 ? f.slice(i) : ""; };
  const urlClassico = () => fonte() + (fonte().indexOf("?") >= 0 ? "&" : "?") + "classico=1";
  const ehPainel = id => TM.paineis.some(p => p.id === id), ehClassico = id => TM.classicos.some(c => c.id === id);
  function salvarPainel(id){ try { localStorage.setItem("fdb_painel", id); } catch (e) {} cookie("fdb_painel", id, 31536000); }
  function irPainel(id){ salvarPainel(id); location.assign("/painel/" + encodeURIComponent(id) + "/" + consulta()); }
  function irClassico(id){
    try { localStorage.setItem("fdb_theme", id); } catch (e) {} cookie("fdb_theme", id, 31536000);
    try { localStorage.removeItem("fdb_painel"); } catch (e) {} cookie("fdb_painel", "", 0);
    location.assign(fonte());
  }
  function aplicarTema(id, remoto){
    if (ehPainel(id)) { if (id === TM.atual) { if (remoto) E().toast("<b>Tema</b> · este painel já está em uso."); return true; } irPainel(id); return true; }
    if (ehClassico(id)) { irClassico(id); return true; }
    return false;
  }
  window.PAINEL_TEMA = {aplicar: aplicarTema};
  const corOk = c => /^#[0-9a-f]{3,8}$/i.test(String(c || "")) ? c : "#888";
  function prevPainel(p){
    const c = p.prev || {}, bg = corOk(c.bg), pn = corOk(c.pn), ac = corOk(c.ac), tx = corOk(c.tx), ln = corOk(c.ln || c.tx);
    const lin = n => Array.from({length: n}, () => `<i style="background:${tx}"></i>`).join("");
    return `<span class="tmP tmPp" style="background:${bg};color:${tx}"><span class="tmPh" style="background:${pn};border-color:${ln}"><i style="background:${ac}"></i></span>` +
      `<span class="tmPk">${[0, 1, 2, 3].map(k => `<i style="background:${pn};border-color:${ln}">${k ? "" : `<b style="background:${ac}"></b>`}</i>`).join("")}</span>` +
      `<span class="tmPc"><i style="background:${pn};border-color:${ln}">${lin(3)}</i><i class="tmPt" style="background:${pn};border-color:${ln}">${lin(6)}</i><i style="background:${pn};border-color:${ln}">${lin(3)}</i></span></span>`;
  }
  function prevClassico(t){
    const c = t.prev || {}, bg = corOk(c.bg), pn = corOk(c.pn), ac = corOk(c.ac), tx = corOk(c.tx);
    return `<span class="tmP tmPcl" style="background:${bg};color:${tx}"><span class="tmPs" style="background:${pn}"><b>Aa</b><i style="background:${tx}"></i><i style="background:${ac}"></i></span>` +
      `<span class="tmPl">${[0, 1, 2].map(k => `<span${k === 1 ? ` style="background:${pn}"` : ""}><em style="background:${ac}"></em><i style="background:${tx}"></i></span>`).join("")}</span></span>`;
  }
  let menu = null;
  function fecharMenu(){ if (!menu) return; menu.classList.remove("on"); const b = $("#btnTema"); if (b) b.setAttribute("aria-expanded", "false"); }
  function abrirMenu(){
    const b = $("#btnTema"); if (!b) return;
    if (!menu) {
      menu = document.createElement("div"); menu.id = "tmMenu"; menu.className = "tmMenu"; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Escolher tema");
      const es = E().esc, atualNome = (TM.paineis.find(p => p.id === TM.atual) || {}).nome || "";
      menu.innerHTML =
        `<div class="tmSec"><div class="tmCab"><b>Painéis de tela única</b><span>Tudo em uma tela; só a lista de vendas rola.</span></div><div class="tmGrade">` +
        TM.paineis.map(p => `<button type="button" class="tmCard" role="menuitemradio" aria-checked="${p.id === TM.atual}" data-tema-id="${es(p.id)}" title="${es(p.descricao || p.nome)}">${prevPainel(p)}<span class="tmNome">${es(p.nome)}</span></button>`).join("") +
        `</div></div><div class="tmSec"><div class="tmCab"><b>Temas clássicos</b><span>O relatório completo, com todas as opções e configurações.</span></div><div class="tmGrade">` +
        TM.classicos.map(t => `<button type="button" class="tmCard" role="menuitemradio" aria-checked="false" data-tema-id="${es(t.id)}">${prevClassico(t)}<span class="tmNome">${es(t.nome)}</span></button>`).join("") +
        `</div></div><div class="tmPe"><span>Em uso: <b>${es(atualNome)}</b></span><a href="${es(urlClassico())}">Abrir o relatório clássico sem trocar o tema</a></div>`;
      document.body.appendChild(menu);
      menu.addEventListener("click", e => { const c = e.target.closest("[data-tema-id]"); if (!c) return; const id = c.dataset.temaId; fecharMenu(); if (id !== TM.atual) aplicarTema(id, false); });
    }
    const r = b.getBoundingClientRect(), estreito = innerWidth <= 820;
    menu.style.top = Math.round(r.bottom + 8) + "px";
    menu.style.left = estreito ? "8px" : "auto"; menu.style.right = estreito ? "8px" : Math.max(8, Math.round(innerWidth - r.right)) + "px";
    menu.style.maxHeight = Math.max(200, innerHeight - r.bottom - 20) + "px";
    menu.classList.add("on"); b.setAttribute("aria-expanded", "true");
    const sel = menu.querySelector('[aria-checked="true"]') || menu.querySelector(".tmCard"); if (sel) sel.focus({preventScroll: true});
  }
  function temaInit(){
    if (TM.atual && ehPainel(TM.atual)) salvarPainel(TM.atual); // o painel aberto passa a ser o escolhido
    const cl = $(".lk-cl"); if (cl) cl.setAttribute("href", urlClassico());
    const b = $("#btnTema"); if (!b) return;
    b.addEventListener("click", e => { e.stopPropagation(); if (menu && menu.classList.contains("on")) fecharMenu(); else abrirMenu(); });
    document.addEventListener("click", e => { if (menu && menu.classList.contains("on") && !menu.contains(e.target)) fecharMenu(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && menu && menu.classList.contains("on")) { e.stopPropagation(); fecharMenu(); b.focus(); } }, true);
    addEventListener("resize", fecharMenu);
  }

  window.PAINEL = {limite: 400, card, vend, detail, ordenar, filtroExtra, intro, after, perfMudou: cfg.perfMudou};
})();
