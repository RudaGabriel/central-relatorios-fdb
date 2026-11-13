/* paineis/motor.js — Central de Relatórios FDB · motor dos painéis de tela única (dados reais, somente leitura).
 * @version 1.0.2
 *   1.0.2 - 2026-11-13 - ENG.perfCtl(): desenha o controle de desempenho criado depois (Configurações do painel);
 *                        escolher um tipo marca todos os botões desse tipo (cabeçalho, menu lateral e painel "Por tipo").
 * Histórico completo das versões: CHANGELOG.md no repositório.
 * Nada aqui escreve no banco: as páginas só leem o que o servidor já entrega ao relatório. */
(function(){
  "use strict";
  const $ = (s,r) => (r||document).querySelector(s), $$ = (s,r) => Array.from((r||document).querySelectorAll(s));
  const html = document.documentElement;
  // ── Modo de desempenho (mesma regra do relatório) ───────────────────────────
  function perfPref(){ try { const v = localStorage.getItem("fdb_perf"); return v === "leve" || v === "completo" ? v : "auto"; } catch (e) { return "auto"; } }
  function perfDecidir(){
    const pref = perfPref(); let leve = false;
    if (pref === "leve") leve = true;
    else if (pref !== "completo") {
      const nv = navigator || {}, mem = Number(nv.deviceMemory) || 0, cpu = Number(nv.hardwareConcurrency) || 0, con = nv.connection || {};
      let med = null; try { med = JSON.parse(localStorage.getItem("fdb_perf_auto") || "null"); } catch (e) {}
      const movel = /Android|iPhone|iPad|iPod|Mobile/i.test(String(nv.userAgent || ""));
      if (med && med.v === "leve" && Date.now() - Number(med.ts || 0) < 7 * 864e5) leve = true;
      else if (con.saveData) leve = true;
      else if ((mem && mem <= 2) || (cpu && cpu <= 2) || (movel && ((mem && mem <= 3) || (cpu && cpu <= 4)))) leve = true;
      else { try { if (matchMedia("(prefers-reduced-motion: reduce)").matches) leve = true; } catch (e) {} }
    }
    html.setAttribute("data-perf", leve ? "leve" : "completo"); html.setAttribute("data-perf-pref", pref);
    return leve;
  }
  let LEVE = perfDecidir();
  const anima = () => !LEVE;

  // ── Formatação ──────────────────────────────────────────────────────────────
  const fmt = v => "R$ " + Number(v || 0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pl = (q,s,p) => q + " " + (q === 1 ? (s || "venda") : (p || "vendas"));
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  const T = ["Gerencial","NFC-e","NF-e"];
  const rotTipo = t => { t = String(t || "").toLowerCase(); return t === "gerencial" ? "Gerencial" : t === "nfc-e" ? "NFC-e" : t === "nf-e" ? "NF-e" : t === "recebimento" ? "Recebimento" : (t || "—"); };
  const dataBR1 = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim()); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso || "").trim(); };
  // Aceita um dia ("2026-11-13") ou um período ("2026-11-01 a 2026-11-13").
  const dataBR = iso => String(iso || "").split(" a ").map(dataBR1).join(" a ");
  // Origem dos dados: o relatório de hoje ("/") ou o do período (?i=AAAA-MM-DD&f=AAAA-MM-DD).
  const FONTE = (function(){
    try { const p = new URLSearchParams(location.search), i = p.get("i") || "", f = p.get("f") || "", ok = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (ok(i) && ok(f) && i <= f) return "/periodo?i=" + i + "&f=" + f; } catch (e) {}
    return "/";
  })();

  function itensDe(x){
    const det = Array.isArray(x.itensDetalhe) ? x.itensDetalhe.filter(i => i && !i.cancelado) : [];
    if (det.length) return det.map(i => ({q: Number(i.qtd) || 1, d: String(i.desc || ""), tot: (i.total != null && isFinite(i.total)) ? Number(i.total) : null}));
    return String(x.itens || "").split(/\n+/).map(s => s.replace(/^⤷\s*/, "").trim()).filter(Boolean).map(s => {
      const m = /^(\d+(?:[.,]\d+)?)\s*x\s*(.+)$/i.exec(s); return m ? {q: Number(m[1].replace(",", ".")) || 1, d: m[2], tot: null} : {q: 1, d: s, tot: null};
    });
  }
  function converter(d){
    return (Array.isArray(d && d.vendas) ? d.vendas : []).map((x, k) => {
      const t = rotTipo(x.tipo), n = String(x.numero || ""), h = String(x.hora || "").slice(0, 5), dt = String(x._dtKey || "");
      return {id: t + "|" + n + "|" + (x.caixa || "") + "|" + dt + "|" + h, n, dt, vend: String(x.vendedor || "").trim() || "(sem vendedor)", t, h,
        pg: String(x.pagamentos || ""), itens: itensDe(x), tot: Number(x.total) || 0, novo: false, cx: String(x.caixa || ""), cli: String(x.cliente || ""),
        seg: String(x.hora || "").slice(0, 8), nat: String(x.natureza || ""), rec: !!x.is_recebimento || t === "Recebimento", mod: Number(x.modelo) || 0,
        fv: (x.formasValores && typeof x.formasValores === "object") ? x.formasValores : {}, raw: x, ri: k};
    }).sort((a, b) => { const ka = a.dt + " " + a.seg, kb = b.dt + " " + b.seg; return kb > ka ? 1 : kb < ka ? -1 : 0; });
  }

  // ── Estado ──────────────────────────────────────────────────────────────────
  let vendas = [], DADOS = null, dataISO = "";
  const st = {tipo: "todos", vend: null, q: ""};
  function filtradas(){
    const extra = x => !window.PAINEL || !PAINEL.filtroExtra || PAINEL.filtroExtra(x);
    // Busca igual à do relatório clássico (mesma sintaxe: -termo, [termo], [proibidos], >100,
    // 10-20, =soma, campo:valor, "frase", a|b, +): o servidor embute o motor dele (window.BUSCA).
    const B = window.BUSCA;
    if (B && B.pronto && DADOS) {
      let c = null;
      try { c = B.ctx(st.q, st.tipo === "Recebimento" ? "todos" : st.tipo, st.vend && st.vend !== "(sem vendedor)" ? st.vend : ""); } catch (e) { c = null; }
      if (c) return vendas.filter(x => (st.tipo === "todos" || x.t === st.tipo) && (!st.vend || x.vend === st.vend) &&
        (!x.raw || B.passa(x.raw, x.ri, c)) && extra(x));
    }
    const q = norm(st.q.trim());
    return vendas.filter(x => (st.tipo === "todos" || x.t === st.tipo) && (!st.vend || x.vend === st.vend) &&
      (!q || norm([x.vend, x.t, x.n, x.pg, fmt(x.tot), x.cli, x.nat, x.cx, x.itens.map(i => i.d).join(" ")].join(" ")).includes(q)) &&
      (!window.PAINEL || !PAINEL.filtroExtra || PAINEL.filtroExtra(x)));
  }
  function resumo(lista){
    const r = {tot: 0, q: lista.length, tipo: {}, vend: {}, hora: {}, horas: []};
    T.forEach(t => r.tipo[t] = {q: 0, tot: 0});
    lista.forEach(x => { r.tot += x.tot; if (r.tipo[x.t]) { r.tipo[x.t].q++; r.tipo[x.t].tot += x.tot; }
      (r.vend[x.vend] = r.vend[x.vend] || {v: x.vend, q: 0, tot: 0}); r.vend[x.vend].q++; r.vend[x.vend].tot += x.tot;
      const h = x.h.slice(0, 2); if (/^\d\d$/.test(h)) r.hora[h] = (r.hora[h] || 0) + x.tot; });
    r.vendL = Object.values(r.vend).sort((a, b) => b.tot - a.tot);
    // Faixa de horas do gráfico: da 1ª à última venda do dia (mínimo de 6 horas).
    const hs = Object.keys(resumo.todasHoras || r.hora).map(Number).filter(n => !isNaN(n));
    let ini = hs.length ? Math.min(...hs) : 8, fim = hs.length ? Math.max(...hs) : 18;
    if (fim - ini < 5) { fim = Math.min(23, ini + 5); ini = Math.max(0, fim - 5); }
    for (let h = ini; h <= fim; h++) r.horas.push(String(h).padStart(2, "0"));
    return r;
  }
  const itensCurtos = (x, max) => { max = max || 4; return {lista: x.itens.slice(0, max), resto: Math.max(0, x.itens.length - max)}; };

  // ── Número animado ──────────────────────────────────────────────────────────
  const anim = new WeakMap();
  function numero(el, to, f){
    if (!el) return; f = f || fmt;
    const from = anim.has(el) ? anim.get(el) : 0; anim.set(el, to);
    if (!anima() || from === to) { el.textContent = f(to); return; }
    const t0 = performance.now(), d = 900;
    const step = now => { const p = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - p, 4);
      el.textContent = f(from + (to - from) * e); if (p < 1 && anim.get(el) === to) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ── Lista com animação FLIP (no Leve: sem animação) ─────────────────────────
  const LIMITE_PADRAO = 120; // linhas desenhadas (a busca encontra todas); PAINEL.limite muda o valor
  function renderLista(){
    const feed = $("#feed"); if (!feed || !window.PAINEL) return;
    const LIMITE = Number(PAINEL.limite) || LIMITE_PADRAO;
    let todas = filtradas(); if (PAINEL.ordenar) todas = PAINEL.ordenar(todas.slice());
    const lista = todas.slice(0, LIMITE);
    const antes = new Map(); if (anima()) $$("[data-id]", feed).forEach(el => antes.set(el.dataset.id, el.getBoundingClientRect()));
    const ids = new Set(lista.map(x => x.id));
    $$("[data-id]", feed).forEach(el => { if (!ids.has(el.dataset.id)) {
      if (!anima()) { el.remove(); return; }
      el.dataset.saindo = "1"; el.style.pointerEvents = "none";
      const a = el.animate([{opacity: 1, transform: "scale(1)"}, {opacity: 0, transform: "scale(.92)"}], {duration: 240, easing: "ease-in"});
      a.onfinish = () => el.remove(); }});
    // Várias colunas (ex.: uma por tipo): PAINEL.alvo(x) devolve o seletor do contêiner dentro de #feed.
    const pos = new Map();
    lista.forEach(x => {
      const alvo = (PAINEL.alvo && feed.querySelector(PAINEL.alvo(x))) || feed;
      const i = pos.get(alvo) || 0; pos.set(alvo, i + 1);
      let el = feed.querySelector('[data-id="' + CSS.escape(x.id) + '"]:not([data-saindo])');
      const novo = !el;
      if (novo || el.dataset.v !== String(x.tot) + "|" + x.novo) {
        const tmp = document.createElement("div"); tmp.innerHTML = PAINEL.card(x).trim(); const nv = tmp.firstElementChild;
        nv.dataset.id = x.id; nv.dataset.v = String(x.tot) + "|" + x.novo;
        if (el) { el.replaceWith(nv); } el = nv;
      }
      const filhos = Array.from(alvo.children).filter(c => c.dataset && c.dataset.id && !c.dataset.saindo);
      const ref = filhos[i]; if (ref !== el) alvo.insertBefore(el, ref || null);
      if (novo && anima()) el.animate([{opacity: 0, transform: "translateY(24px) scale(.96)"}, {opacity: 1, transform: "none"}],
        {duration: x.novo ? 900 : 520, delay: x.novo ? 0 : Math.min(i, 12) * 40, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards"});
    });
    if (anima()) $$("[data-id]:not([data-saindo])", feed).forEach(el => { const r0 = antes.get(el.dataset.id); if (!r0) return;
      const r1 = el.getBoundingClientRect(), dx = r0.left - r1.left, dy = r0.top - r1.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{transform: `translate(${dx}px,${dy}px)`}, {transform: "none"}], {duration: 480, easing: "cubic-bezier(.2,.8,.2,1)"}); });
    const vazio = $("#vazio"); if (vazio) { vazio.style.display = todas.length ? "none" : ""; vazio.textContent = vendas.length ? "Nenhuma venda encontrada para este filtro." : "Ainda não há vendas hoje."; }
    const mais = $("#mais"); if (mais) { const LIMITE = Number(PAINEL.limite) || LIMITE_PADRAO; mais.style.display = todas.length > LIMITE ? "" : "none"; mais.textContent = "Mostrando " + LIMITE + " de " + todas.length + " vendas — use a busca para encontrar as demais."; }
    renderResumo(todas);
  }
  function renderResumo(lista){
    resumo.todasHoras = null; const g = resumo(vendas); resumo.todasHoras = g.hora;
    const r = resumo(lista);
    numero($("[data-n=total]"), r.tot); numero($("[data-n=qt]"), r.q, v => pl(Math.round(v)));
    numero($("[data-n=ticket]"), r.q ? r.tot / r.q : 0);
    T.forEach(t => { numero($('[data-n="t-' + t + '"]'), r.tipo[t].tot); $$('[data-q="t-' + t + '"]').forEach(q => q.textContent = pl(r.tipo[t].q)); });
    const vl = $("#vends"); if (vl && PAINEL.vend) {
      const base = resumo(vendas.filter(x => st.tipo === "todos" || x.t === st.tipo));
      vl.innerHTML = PAINEL.vend({v: null, q: base.q, tot: base.tot}, !st.vend, base.tot, -1) + base.vendL.map((v, k) => PAINEL.vend(v, st.vend === v.v, base.tot, k)).join("");
    }
    const ch = $("#chart"); if (ch && PAINEL.chart) PAINEL.chart(ch, r);
    $$("[data-hoje]").forEach(e => e.textContent = dataBR(dataISO));
    if (PAINEL.after) PAINEL.after(r, g);
    resumo.todasHoras = null;
  }

  // ── Detalhe ─────────────────────────────────────────────────────────────────
  function abrir(id, origem){
    const x = vendas.find(v => v.id === id); if (!x) return;
    const detalhe = PAINEL.detail ? PAINEL.detail(x) : ('<div class="k">' + esc(x.t) + ' · Nº ' + esc(x.n) + ' · ' + x.h + (x.cx ? ' · Caixa ' + esc(x.cx) : '') + '</div><h2>' + fmt(x.tot) + '</h2><div class="m">' + esc(x.vend) + ' · ' + esc(x.pg) + '</div>' +
      x.itens.map(i => '<div class="row"><span>' + i.q + '× ' + esc(i.d) + '</span><b>' + (i.tot != null ? fmt(i.tot) : '') + '</b></div>').join(''));
    let ov = $("#ov"); if (!ov) { ov = document.createElement("div"); ov.id = "ov"; document.body.appendChild(ov); }
    ov.innerHTML = '<div class="det" role="dialog" aria-modal="true">' + detalhe + '<button class="fechar" type="button" aria-label="Fechar">×</button></div>';
    ov.className = "on"; const det = $(".det", ov);
    if (anima() && origem) { const r = origem.getBoundingClientRect(), d = det.getBoundingClientRect();
      det.animate([{transform: `translate(${r.left + r.width / 2 - (d.left + d.width / 2)}px,${r.top + r.height / 2 - (d.top + d.height / 2)}px) scale(${Math.max(.3, Math.min(1, r.width / d.width))})`, opacity: .2}, {transform: "none", opacity: 1}],
        {duration: 480, easing: "cubic-bezier(.2,.8,.2,1)"});
      ov.animate([{opacity: 0}, {opacity: 1}], {duration: 260}); }
    const fechar = () => { document.removeEventListener("keydown", esc_); if (!anima()) { ov.className = ""; ov.innerHTML = ""; return; }
      const a = det.animate([{transform: "none", opacity: 1}, {transform: "scale(.94)", opacity: 0}], {duration: 200, easing: "ease-in"});
      ov.animate([{opacity: 1}, {opacity: 0}], {duration: 220}); a.onfinish = () => { ov.className = ""; ov.innerHTML = ""; }; };
    const esc_ = e => { if (e.key === "Escape") fechar(); };
    $(".fechar", ov).onclick = fechar; ov.onclick = e => { if (e.target === ov) fechar(); };
    document.addEventListener("keydown", esc_);
  }

  // ── Proibidos (como no relatório clássico) ─────────────────────────────────
  // Lista DESTE aparelho (window.__APARELHO__, injetada pelo servidor) — vale mesmo vazia;
  // sem ela, a embutida no relatório; depois sincroniza com /api/proibidos.
  let proibOk = false;
  function proibidosIniciais(){
    if (proibOk || !window.BUSCA) return; proibOk = true;
    let ap = null; try { const a = window.__APARELHO__; if (a && a.prefs && Array.isArray(a.prefs.proibidos)) ap = a.prefs.proibidos.map(String); } catch (e) {}
    if (ap) BUSCA.proibidos(ap); else if (DADOS && Array.isArray(DADOS.proibidosServidor) && DADOS.proibidosServidor.length) BUSCA.proibidos(DADOS.proibidosServidor);
    fetch("/api/proibidos", {cache: "no-store", credentials: "same-origin"}).then(r => r.json()).then(d => {
      if (Array.isArray(d.proibidos) && (d.efetivo === true || d.proibidos.length)) { const antes = BUSCA.lista().join("\n"); BUSCA.proibidos(d.proibidos); if (BUSCA.lista().join("\n") !== antes) renderLista(); }
    }).catch(() => {});
  }
  // Preferências do aparelho mudaram (SSE "prefs"): relê duração dos avisos e proibidos.
  function aplicarPrefs(){
    fetch("/api/preferencias", {cache: "no-store", credentials: "same-origin"}).then(r => r.json()).then(d => {
      if (!d || !d.ok || !d.prefs) return;
      const td = parseInt(d.prefs.toastDuration, 10); if (td >= 500 && td <= 60000) window.__TOAST_MS = td;
      if (window.BUSCA && Array.isArray(d.prefs.proibidos)) { const antes = BUSCA.lista().join("\n"); BUSCA.proibidos(d.prefs.proibidos); if (BUSCA.lista().join("\n") !== antes) renderLista(); }
    }).catch(() => {});
  }
  // Duração dos avisos: a do aparelho, senão a do sistema (config.json → toastDuration).
  try { const a = window.__APARELHO__, td = parseInt(a && a.prefs && a.prefs.toastDuration, 10), tp = parseInt(window.FDB_TEMAS && FDB_TEMAS.toastMs, 10);
    window.__TOAST_MS = td >= 500 && td <= 60000 ? td : tp >= 500 ? tp : 5000; } catch (e) { window.__TOAST_MS = 5000; }

  // ── Aviso (mesmo padrão do relatório clássico) ──────────────────────────────
  // Texto, botão de fechar e barra de tempo restante; o mesmo aviso não se repete enquanto
  // estiver na tela. A barra usa a Web Animations API (funciona também no modo Leve).
  const avisosNaTela = new Set();
  function toast(txt){
    const chave = String(txt || ""); if (!chave || avisosNaTela.has(chave)) return; avisosNaTela.add(chave);
    let box = $("#toasts"); if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = "tst"; t.setAttribute("role", "status");
    t.innerHTML = '<div class="tst-tx">' + chave + '</div><button type="button" class="tst-x" aria-label="Fechar aviso"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><i class="tst-tr"></i><i class="tst-br"></i>';
    box.appendChild(t);
    const dur = Math.max(500, Number(window.__TOAST_MS) || 5000);
    let fora = false;
    const tirar = () => { if (fora) return; fora = true; t.classList.remove("on"); setTimeout(() => { t.remove(); avisosNaTela.delete(chave); }, anima() ? 220 : 0); };
    $(".tst-x", t).addEventListener("click", tirar);
    requestAnimationFrame(() => t.classList.add("on"));
    const bar = $(".tst-br", t); if (bar && bar.animate) bar.animate([{transform: "scaleX(1)"}, {transform: "scaleX(0)"}], {duration: dur, easing: "linear", fill: "forwards"});
    setTimeout(tirar, dur);
  }

  // ── Carregar dados reais ────────────────────────────────────────────────────
  let carregando = false, primeira = true, tentativas = 0;
  function aviso(txt){ const a = $("#estado"); if (a) { a.textContent = txt; a.style.display = txt ? "" : "none"; } }
  async function carregar(){
    if (carregando) return; carregando = true;
    try {
      const r = await fetch(FONTE, {cache: "no-store", credentials: "same-origin"});
      const txt = await r.text();
      const m = /<script id="dados" type="application\/json">([\s\S]*?)<\/script>/.exec(txt);
      if (!m) { aviso(FONTE === "/" ? "Gerando o relatório de hoje… aguarde." : "Gerando o relatório do período… aguarde."); setTimeout(() => { carregando = false; carregar(); }, Math.min(8000, 1500 + 500 * tentativas++)); return; }
      tentativas = 0; aviso("");
      DADOS = JSON.parse(m[1]); dataISO = String(DADOS.data || "");
      if (window.BUSCA) { try { BUSCA.indexar(DADOS); proibidosIniciais(); } catch (e) {} }
      const novas = converter(DADOS), antigos = new Set(vendas.map(v => v.id));
      const chegaram = primeira ? [] : novas.filter(v => !antigos.has(v.id));
      novas.forEach(v => v.novo = chegaram.some(c => c.id === v.id));
      vendas = novas;
      renderLista();
      chegaram.slice(0, 3).forEach(x => toast("<b>Venda nova</b> · " + esc(x.vend) + " · " + fmt(x.tot)));
      if (chegaram.length) { const p = $("[data-pulso]"); if (p && anima()) {
        // Blocos largos não crescem (passariam da largura da tela): pulsam com brilho.
        const largo = p.getBoundingClientRect().width > innerWidth * 0.6;
        p.animate(largo ? [{filter: "brightness(1)"}, {filter: "brightness(1.35)"}, {filter: "brightness(1)"}] : [{transform: "scale(1)"}, {transform: "scale(1.03)"}, {transform: "scale(1)"}], {duration: 650, easing: "ease-out"}); } }
      primeira = false;
    } catch (e) {
      aviso("Sem conexão com o servidor de relatórios — tentando novamente…");
      setTimeout(() => { carregando = false; carregar(); }, 5000); return;
    }
    carregando = false;
  }
  function aoVivo(){
    let es = null, tent = 0;
    const con = () => { try { es = new EventSource("/api/events");
      es.onmessage = ev => { try { const d = JSON.parse(ev.data);
        // "Recarregar ao detectar mudanças" (Configurações → Atualização, como no clássico):
        // ligado, recarrega como F5; desligado, só traz as vendas novas, sem recarregar.
        if (d.type === "reload") { if (window.PAINEL && PAINEL.recarregar && PAINEL.recarregar()) { location.reload(); return; } carregar(); }
        // Controle remoto (api.ps1): troca de tema, navegação e aviso nas telas abertas.
        else if (d.type === "tema" && d.id) { if (window.PAINEL_TEMA) window.PAINEL_TEMA.aplicar(String(d.id), true); }
        else if (d.type === "navigate") { let u = String(d.url || "/"); if (u.charAt(0) !== "/" || u.charAt(1) === "/") u = "/"; location.assign(u); }
        else if (d.type === "aviso" && d.msg) toast("<b>Aviso</b> · " + esc(String(d.msg).slice(0, 300)));
        else if (d.type === "prefs") aplicarPrefs();
        else if (d.type === "encerrando") aviso(d.reiniciando ? "O servidor está reiniciando — reconectando…" : "O servidor de relatórios foi encerrado.");
      } catch (e) {} };
      es.onopen = () => { tent = 0; const a = $("#estado"); if (a && /^O servidor/.test(a.textContent)) aviso(""); };
      es.onerror = () => { try { es.close(); } catch (e) {} tent++; setTimeout(con, Math.min(30000, 2000 * tent)); };
    } catch (e) { setTimeout(con, 5000); } };
    con();
    setInterval(carregar, 60000); // reserva: confere a cada minuto
  }

  // ── Controle de desempenho (Automático / Completo / Leve) ───────────────────
  function controlePerf(){
    $$("[data-perf-ctl]").forEach(box => {
      const ops = [["auto", "Automático"], ["completo", "Completo"], ["leve", "Leve"]];
      box.innerHTML = '<span class="perfRot">Desempenho</span>' + ops.map(([v, t]) => `<button type="button" data-perf-op="${v}" aria-pressed="${perfPref() === v}">${t}</button>`).join("");
    });
  }
  document.addEventListener("click", e => {
    const p = e.target.closest("[data-perf-op]");
    if (p) { try { if (p.dataset.perfOp === "auto") localStorage.removeItem("fdb_perf"); else localStorage.setItem("fdb_perf", p.dataset.perfOp); } catch (er) {}
      LEVE = perfDecidir(); controlePerf(); if (window.PAINEL && PAINEL.perfMudou) PAINEL.perfMudou(LEVE);
      toast("<b>Desempenho</b> · " + (LEVE ? "Leve (sem animações pesadas)" : "Completo")); return; }
    const tp = e.target.closest("[data-tipo]"); if (tp) { st.tipo = tp.dataset.tipo; $$("[data-tipo]").forEach(b => b.classList.toggle("on", b.dataset.tipo === st.tipo)); renderLista(); return; }
    const vd = e.target.closest("[data-vend]"); if (vd) { st.vend = vd.dataset.vend || null; renderLista(); return; }
    const cd = e.target.closest("#feed [data-id]"); if (cd) abrir(cd.dataset.id, cd);
  });

  function ligar(){
    const q = $("#q"); if (q) { let tm = 0; q.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { st.q = q.value; renderLista(); }, 160); }); }
    controlePerf();
    if (window.PAINEL && PAINEL.intro) PAINEL.intro();
    aviso(FONTE === "/" ? "Carregando as vendas de hoje…" : "Carregando as vendas do período…");
    carregar(); aoVivo();
  }
  window.ENG = {fmt, esc, pl, st, numero, resumo, toast, T, itensCurtos, leve: () => LEVE, anima, get vendas(){ return vendas; }, get dados(){ return DADOS; }, dataBR, norm, FONTE,
    filtradas, render: () => renderLista(), abrir, perfCtl: () => controlePerf(), perfPref};
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar); else ligar();
})();
