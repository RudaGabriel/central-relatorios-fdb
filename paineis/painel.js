/* paineis/painel.js — Central de Relatórios FDB · conteúdo comum dos painéis de tela única.
 * @version 1.7.1
 *   1.7.1 - 2026-11-17 - Foto ampliada sem a dica do navegador por cima (o title do avatar com foto é retirado).
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
  // Ícones SVG (traço, no padrão do projeto) — nada de emojis ou símbolos de texto na tela (regra do projeto).
  const ICO = p => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICO_BAIXO = ICO('<path d="m6 9 6 6 6-6"/>'), ICO_CIMA = ICO('<path d="m18 15-6-6-6 6"/>');
  const ICO_SOMA = ICO('<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>');
  const num = v => Number(v || 0).toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const int = v => Math.round(Number(v) || 0).toLocaleString("pt-BR");
  const pct = (a, b) => b ? (a / b * 100) : 0;
  const pctTxt = p => (Math.round(p * 10) / 10).toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1}) + "%";
  const qtd = q => (Math.round(Number(q) * 1000) / 1000).toLocaleString("pt-BR");
  // v1.2.0: linhas de desconto/acréscimo (i.aj, marcadas pelo motor) não são produto: ficam fora das contagens.
  const prods = x => x.itens.filter(i => !i.aj);
  const qProd = x => prods(x).reduce((s, i) => s + (Number(i.q) || 0), 0);
  // Percentual do desconto como no relatório clássico: inteiro a partir de 1%, uma casa abaixo disso.
  const pctDesc = p => p >= 1 ? String(Math.round(p)) : (Math.round(p * 10) / 10 > 0 ? String(Math.round(p * 10) / 10).replace(".", ",") : "<0,1");
  const descTxt = d => d.pct != null ? "Desconto de " + pctDesc(d.pct) + "% (−" + E().fmt(d.valor) + ")" : "Venda com desconto (valor não registrado no banco)";

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
  const COLS = [["hora", "Hora"], ["tipo", "Tipo"], ["numero", "Nº"], ["caixa", "Cx"], ["vendedor", "Vendedor"], ["cliente", "Cliente / natureza"], ["itens", "Itens"], ["desc", "Desc."], ["pag", "Pagamento"], ["total", "Total"]];
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
  function marcaOrd(){ $$("[data-ord]").forEach(b => { const on = b.dataset.ord === ord.k; b.classList.toggle("on", on); const i = b.querySelector("i"); if (i) i.innerHTML = on ? (ord.d < 0 ? ICO_BAIXO : ICO_CIMA) : ""; }); }

  // ── Linha da tabela ─────────────────────────────────────────────────────────
  function card(x){
    const en = E(), es = en.esc, q = qProd(x);
    const itTxt = i => i.aj ? i.d + (i.tot != null ? " " + num(i.tot) : "") : qtd(i.q) + "× " + i.d;
    const it = x.itens.map(itTxt).join(" · ");
    // Dica dos itens e do pagamento (v1.5.0): um item (ou uma forma de pagamento) por linha.
    const itDica = x.itens.map(i => itTxt(i) + (!i.aj && i.tot != null ? " — " + num(i.tot) : "")).join("\n");
    const pgDica = formasDe(x).map(f => f.k + (f.v != null ? " — " + en.fmt(f.v) : "")).join("\n");
    const dsc = x.dsc ? `<em class="c-dsc mn" title="${es(descTxt(x.dsc))}">${x.dsc.pct != null ? "−" + pctDesc(x.dsc.pct) + "%" : "desc."}</em>` : "";
    const fs = formasDe(x);
    const cli = x.cli || x.nat || "";
    return `<div class="lv${x.novo ? " novo" : ""}${x.rec ? " rec" : ""}" style="--c:${COR[x.t] || "#94a3b8"}">` +
      `<span class="c-hora mn">${es(x.seg || x.h)}</span>` +
      `<span class="c-tipo"><i class="tg">${es(SIG[x.t] || x.t)}</i></span>` +
      `<span class="c-numero mn">${es(x.n)}</span>` +
      `<span class="c-caixa mn">${es(x.cx || "—")}</span>` +
      `<span class="c-vendedor" title="${es(x.vend)}">${es(x.vend)}</span>` +
      `<span class="c-cliente${cli ? "" : " vz"}" title="${es(cli)}">${es(cli || "—")}</span>` +
      `<span class="c-itens" title="${es(itDica || it)}"><b class="mn">${qtd(q)}</b><span class="c-it">${es(it || "—")}</span></span>` +
      `<span class="c-desc">${dsc}</span>` +
      // Várias formas: a primeira e "+N" (todas, com os valores, ficam na dica), para caberem sem corte.
      `<span class="c-pag" title="${es(pgDica)}">${fs.length ? `<i>${es(fs[0].k)}</i>` + (fs.length > 1 ? `<i class="pgMais mn">+${fs.length - 1}</i>` : "") : ""}</span>` +
      `<span class="c-total mn">${num(x.tot)}</span></div>`;
  }

  // ── Vendedor (linha do ranking) ─────────────────────────────────────────────
  const AV = ["#e542a3", "#1f7aec", "#d16b00", "#00a884", "#7f66ff", "#c4532c", "#027eb5", "#a62c71", "#0f766e", "#b45309"];
  const corAv = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
  // ── Fotos dos vendedores (v1.5.0) ──────────────────────────────────────────
  // Clicar no avatar (as iniciais) escolhe uma foto. O navegador já converte: recorta em quadrado
  // (com o enquadramento puxado para cima, onde costuma estar o rosto), reduz para 256×256 e envia
  // como JPEG leve. As fotos valem para todos os aparelhos e só são trocadas no computador do servidor.
  let fotos = {}, fotoIn = null, fotoAlvo = "", fotoMenu = null;
  // v1.7.0: as funções novas dependem de rotas do servidor. Os arquivos dos painéis são lidos do disco a
  // cada abertura, então, logo depois de uma atualização, a tela nova pode estar rodando com o servidor
  // antigo (ainda não reiniciado). A versão do servidor chega em FDB_TEMAS.srv (servidor 2.32.0+).
  const MSG_REINICIAR = "O servidor precisa ser reiniciado para ativar esta função: na bandeja do computador do servidor, clique em Reiniciar servidor.";
  const verNum = v => String(v || "").split(".").map(n => parseInt(n, 10) || 0).reduce((a, n, i) => a + n * Math.pow(1000, 2 - i), 0);
  const servidorTem = min => { const v = window.FDB_TEMAS && window.FDB_TEMAS.srv; return !!v && verNum(v) >= verNum(min); };
  // Mensagem de uma resposta com erro: a do servidor; sem resposta no formato esperado (rota inexistente
  // no servidor antigo), pede para reiniciar.
  const erroDe = (r, j, padrao) => (j && j.erro) ? j.erro : (!j || r.status === 404 || r.status === 405) ? MSG_REINICIAR : padrao;
  const normVend = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim().slice(0, 120);
  function avatar(nome){
    const es = E().esc;
    if (!nome) return `<span class="vd-av" style="--av:var(--ac)">${ICO_SOMA}</span>`;
    const url = fotos[normVend(nome)];
    const dica = url ? "Clique para trocar ou remover a foto" : "Clique para colocar a foto do vendedor";
    return `<span class="vd-av${url ? " comFoto" : ""}" data-foto-vend="${es(nome)}" role="button" tabindex="0" title="${dica}" style="--av:${corAv(nome)}">` +
      (url ? `<img src="${es(url)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove('comFoto');this.remove()">` : "") +
      `<b>${es(iniciais(nome))}</b></span>`;
  }
  async function carregarFotos(){
    try { const r = await fetch("/api/fotos-vendedores", {cache: "no-store", credentials: "same-origin"}); const j = await r.json(); fotos = (j && j.ok && j.fotos && typeof j.fotos === "object") ? j.fotos : {}; }
    catch (e) { return; }
    try { E().render(); } catch (e) {}
  }
  function fecharFotoMenu(){ if (fotoMenu) { fotoMenu.remove(); fotoMenu = null; } }
  function abrirFotoMenu(av, nome){
    fecharFotoMenu();
    fotoMenu = document.createElement("div"); fotoMenu.className = "fotoMenu"; fotoMenu.setAttribute("role", "menu");
    fotoMenu.innerHTML = `<button type="button" data-fm="trocar" role="menuitem">Trocar foto</button><button type="button" data-fm="remover" role="menuitem">Remover foto</button>`;
    document.body.appendChild(fotoMenu);
    const z = zLer(), r = av.getBoundingClientRect(), w = fotoMenu.offsetWidth * z, a = fotoMenu.offsetHeight * z;
    let x = Math.max(8, Math.min(r.left, innerWidth - w - 8)), y = r.bottom + 6; if (y + a > innerHeight - 8) y = Math.max(8, r.top - a - 6);
    fotoMenu.style.left = Math.round(x / z) + "px"; fotoMenu.style.top = Math.round(y / z) + "px";
    fotoMenu.addEventListener("click", e => { const b = e.target.closest("[data-fm]"); if (!b) return; e.stopPropagation(); fecharFotoMenu(); if (b.dataset.fm === "trocar") escolherFoto(nome); else removerFoto(nome); });
    const f = fotoMenu.querySelector("button"); if (f) f.focus({preventScroll: true});
  }
  function escolherFoto(nome){
    fotoAlvo = nome;
    if (!fotoIn) {
      fotoIn = document.createElement("input"); fotoIn.type = "file"; fotoIn.accept = "image/*"; fotoIn.hidden = true;
      fotoIn.addEventListener("change", () => { const f = fotoIn.files && fotoIn.files[0]; fotoIn.value = ""; if (f && fotoAlvo) enviarFoto(fotoAlvo, f); });
      document.body.appendChild(fotoIn);
    }
    fotoIn.click();
  }
  // Recorta em quadrado (puxado para cima) e reduz para 256×256 em JPEG. Devolve um Blob ou null.
  function converterFoto(arq){
    return new Promise(ok => {
      const url = URL.createObjectURL(arq), img = new Image();
      img.onload = () => {
        try {
          const L = 256, w = img.naturalWidth, h = img.naturalHeight, lado = Math.min(w, h);
          if (!lado) { URL.revokeObjectURL(url); ok(null); return; }
          const sx = (w - lado) / 2, sy = h > w ? (h - lado) * 0.3 : 0;
          const c = document.createElement("canvas"); c.width = L; c.height = L;
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, L, L);
          g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
          g.drawImage(img, sx, sy, lado, lado, 0, 0, L, L);
          URL.revokeObjectURL(url);
          c.toBlob(b => ok(b && b.size ? b : null), "image/jpeg", 0.86);
        } catch (e) { URL.revokeObjectURL(url); ok(null); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); ok(null); };
      img.src = url;
    });
  }
  async function enviarFoto(nome, arq){
    const en = E();
    if (!/^image\//.test(arq.type || "image/")) { en.toast("<b>Foto</b> · Escolha um arquivo de imagem."); return; }
    if (arq.size > 25 * 1024 * 1024) { en.toast("<b>Foto</b> · Imagem muito grande (máximo de 25 MB)."); return; }
    const blob = await converterFoto(arq);
    if (!blob) { en.toast("<b>Foto</b> · Não foi possível abrir esta imagem. Use uma foto JPEG ou PNG."); return; }
    let r = null, j = null;
    try { r = await fetch("/api/foto-vendedor?nome=" + encodeURIComponent(nome), {method: "POST", headers: {"Content-Type": "application/octet-stream"}, body: blob, credentials: "same-origin"}); } catch (e) { r = null; }
    if (!r) { en.toast("<b>Foto</b> · Sem conexão com o servidor. Tente novamente."); return; }
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok || !j || !j.ok) { en.toast("<b>Foto</b> · " + en.esc(erroDe(r, j, "Não foi possível salvar a foto."))); return; }
    if (j.foto) fotos[normVend(nome)] = j.foto;
    en.render(); en.toast("<b>Foto</b> · Foto de " + en.esc(nome) + " atualizada.");
  }
  async function removerFoto(nome){
    const en = E(); let r = null, j = null;
    try { r = await fetch("/api/remover-foto-vendedor?nome=" + encodeURIComponent(nome), {method: "POST", credentials: "same-origin"}); } catch (e) { r = null; }
    if (!r) { en.toast("<b>Foto</b> · Sem conexão com o servidor. Tente novamente."); return; }
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok || !j || !j.ok) { en.toast("<b>Foto</b> · " + en.esc(erroDe(r, j, "Não foi possível remover a foto."))); return; }
    delete fotos[normVend(nome)]; en.render(); en.toast("<b>Foto</b> · Foto de " + en.esc(nome) + " removida.");
  }
  // Foto ampliada ao passar o mouse sobre um avatar com foto (v1.7.0), junto da seta, com o nome.
  let fotoZoom = null, fotoZoomAlvo = null;
  function zoomFoto(av, cx, cy){
    dicaPrep(av); // tira o title: sem a dica do navegador por cima da foto ampliada
    const img = av.querySelector("img"); if (!img || !img.complete || !img.naturalWidth) return;
    if (!fotoZoom) { fotoZoom = document.createElement("div"); fotoZoom.id = "fotoZoom"; fotoZoom.setAttribute("aria-hidden", "true"); fotoZoom.innerHTML = "<img alt=''><b></b><small>Clique para trocar ou remover a foto</small>"; document.body.appendChild(fotoZoom); }
    if (fotoZoomAlvo !== av) { fotoZoom.querySelector("img").src = img.src; fotoZoom.querySelector("b").textContent = av.dataset.fotoVend || ""; fotoZoomAlvo = av; }
    fotoZoom.classList.add("on");
    const z = zLer(), w = fotoZoom.offsetWidth * z, a = fotoZoom.offsetHeight * z;
    let x = cx + 14, y = cy + 18;
    if (x + w > innerWidth - 8) x = cx - w - 10;
    if (y + a > innerHeight - 8) y = cy - a - 10;
    x = Math.max(8, Math.min(x, innerWidth - w - 8)); y = Math.max(8, Math.min(y, innerHeight - a - 8));
    fotoZoom.style.left = Math.round(x / z) + "px"; fotoZoom.style.top = Math.round(y / z) + "px";
  }
  function zoomFotoFechar(){ if (fotoZoom) fotoZoom.classList.remove("on"); fotoZoomAlvo = null; }
  function cliqueAvatar(av){
    zoomFotoFechar();
    const nome = av.dataset.fotoVend || ""; if (!nome) return;
    if (!servidorTem("2.31.0")) { E().toast("<b>Foto</b> · " + E().esc(MSG_REINICIAR)); return; }
    if (fotos[normVend(nome)]) abrirFotoMenu(av, nome); else escolherFoto(nome);
  }

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
      `<span class="vd-r mn">${v.v ? k + 1 : ICO_SOMA}</span>${avatar(v.v)}<span class="vd-n">${v.v ? es(v.v) : "Todos"}</span>` +
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
    const arr = Object.keys(g).map(k => ({k, ...g[k]})).sort((a, b) => b.t - a.t || b.q - a.q || String(a.k).localeCompare(String(b.k), "pt-BR"));
    el.innerHTML = arr.length ? arr.map(o => barraLinha(` data-cx="${E().esc(o.k)}" title="Filtrar: caixa ${E().esc(o.k)}"`, ext.cx === o.k, cfg.corCaixa || "#64748b", "Caixa " + E().esc(o.k), o.q, o.t, pct(o.t, tot))).join("") : `<div class="obs">Sem vendas.</div>`;
  }
  // Dados do gráfico de horas guardados para a dica personalizada (v1.2.0).
  let horasDados = {g: {}, tot: 0};
  function pHoras(l){
    const el = $("#horas"); if (!el) return; const en = E(), hs = en.resumo(en.vendas).horas, g = {};
    l.forEach(x => { const h = x.h.slice(0, 2); const o = g[h] || (g[h] = {}); o[x.t] = (o[x.t] || 0) + x.tot; o["q" + x.t] = (o["q" + x.t] || 0) + 1; o._ = (o._ || 0) + x.tot; o.q = (o.q || 0) + 1; });
    horasDados = {g, tot: l.reduce((s, x) => s + x.tot, 0)}; hrAtual = null; // a próxima passada do mouse redesenha a dica
    const mx = Math.max(1, ...hs.map(h => (g[h] || {})._ || 0)), agora = String(new Date().getHours()).padStart(2, "0");
    let pico = null; hs.forEach(h => { if (g[h] && (!pico || g[h]._ > g[pico]._)) pico = h; });
    el.innerHTML = `<div class="hr-g">${hs.map(h => { const o = g[h] || {};
      const seg = en.T.concat(["Recebimento"]).filter(t => o[t]).map(t => `<i style="height:${(o[t] / mx * 100).toFixed(2)}%;background:${COR[t]}"></i>`).join("");
      return `<div class="hr-c${h === agora ? " ag" : ""}${h === pico ? " pk" : ""}" data-h="${h}" aria-label="${h}h · ${o.q || 0} venda(s) · ${en.esc(en.fmt(o._ || 0))}"><div class="hr-s">${seg}</div><small>${h}</small></div>`; }).join("")}</div>` +
      `<div class="hr-l">${pico ? `Pico: <b>${pico}h</b> · <b class="mn">${num(g[pico]._)}</b> em ${g[pico].q} venda(s)` : "Sem vendas no período."}</div>`;
  }
  function pProdutos(l){
    const el = $("#produtos"); if (!el) return; const g = new Map();
    l.forEach(x => prods(x).forEach(i => { const k = String(i.d || "").trim() || "(sem descrição)"; const o = g.get(k) || {q: 0, t: 0, semT: false}; o.q += Number(i.q) || 0; if (i.tot != null) o.t += i.tot; else o.semT = true; g.set(k, o); }));
    const arr = Array.from(g, ([k, o]) => ({k, ...o})).sort((a, b) => b.t - a.t || b.q - a.q).slice(0, cfg.topProdutos || 12), mx = Math.max(1, ...arr.map(o => o.t || 0));
    el.innerHTML = arr.length ? arr.map((o, i) => `<div class="pd" title="${E().esc(o.k)}"><span class="pd-r mn">${i + 1}</span><span class="pd-n">${E().esc(o.k)}</span><span class="pd-q mn">${qtd(o.q)} un</span><span class="pd-t mn">${o.t ? num(o.t) : "—"}</span><span class="pd-b"><i style="width:${(o.t / mx * 100).toFixed(2)}%"></i></span></div>`).join("") : `<div class="obs">Sem itens.</div>`;
  }
  function pConv(){
    const el = $("#conv"); if (!el) return; const en = E(), d = (en.dados && en.dados.duplicatas) || {};
    // v1.2.0: conversões vinculadas pelo banco (gerador 3.34.0+), inclusive as gerenciais que o PDV marca como
    // convertidas; as prováveis (reconciliação por valor) vêm das duplicatas. Gerador antigo: só as duplicatas.
    const conv = en.dados && Array.isArray(en.dados.conversoes) ? en.dados.conversoes : null;
    const semZ = v => String(v || "").replace(/^0+/, "");
    const cf = conv || (Array.isArray(d.confirmadas) ? d.confirmadas : []);
    const jaTem = new Set(cf.map(o => semZ(o.gerencial)));
    const pv = (Array.isArray(d.provaveis) ? d.provaveis : []).filter(o => !jaTem.has(semZ(o.gerencial)));
    const lin = (o, tipo) => `<div class="cv ${tipo}"><span class="mn">${en.esc(String(o.hora || "").slice(0, 5) || "—")}</span><span title="Gerencial ${en.esc(o.gerencial || "—")} convertida em ${o.docNumero ? (Number(o.docModelo) === 55 ? "NF-e" : "NFC-e") + " " + en.esc(o.docNumero) : "documento fiscal"}"><b class="mn">${en.esc(o.gerencial || "—")}</b> → ${o.docNumero ? (Number(o.docModelo) === 55 ? "NF-e" : "NFC-e") + ` <b class="mn">${en.esc(o.docNumero)}</b>` : "nota fiscal"}</span><span class="mn">${o.total != null ? num(o.total) : ""}</span><em>Gerencial · ${tipo === "cf" ? "confirmada" : "provável"}</em></div>`;
    const n = cf.length + pv.length, cont = $("#conv-n"); if (cont) cont.textContent = n ? String(n) : "";
    el.innerHTML = n ? cf.map(o => lin(o, "cf")).join("") + pv.map(o => lin(o, "pv")).join("") : `<div class="obs">Nenhuma gerencial convertida em nota hoje (nada contado em dobro).</div>`;
  }
  function pKpis(l){
    const en = E(); if (!$("#kpis")) return;
    const it = l.reduce((s, x) => s + qProd(x), 0), tot = l.reduce((s, x) => s + x.tot, 0);
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
    f.innerHTML = ch.length ? ch.map(([k, t]) => `<button type="button" data-limpa="${k}" title="Remover este filtro">${es(t)} <b>×</b></button>`).join("") : "";
    f.classList.toggle("vazio", !ch.length);
    const bl = $("#btnLimpar"); if (bl) { bl.disabled = !ch.length && ord.k === "hora" && ord.d === -1; }
    const bp = $("#btnProib"); if (bp) bp.setAttribute("aria-pressed", PROIB_RE.test(en.st.q) ? "true" : "false");
    buscaX();
  }

  // ── Dica do gráfico de horas (v1.2.0) ───────────────────────────────────────
  // Ao passar o mouse (ou tocar) numa barra: hora, vendas, total, parte do dia, ticket médio e a
  // divisão por tipo. Uma só caixa, reaproveitada; posicionada dentro da tela (com o zoom do texto).
  let hrTip = null, hrAtual = null;
  function hrDica(h){
    const en = E(), es = en.esc, o = horasDados.g[h] || {}, q = o.q || 0, t = o._ || 0;
    const tipos = en.T.concat(["Recebimento"]).filter(k => o[k]);
    return `<div class="ht-h"><b>${es(h)}h</b> às ${es(h)}h59</div>` +
      `<div class="ht-l"><span>Vendas</span><b class="mn">${q}</b></div>` +
      `<div class="ht-l"><span>Total</span><b class="mn">${es(en.fmt(t))}</b></div>` +
      (q ? `<div class="ht-l"><span>Ticket médio</span><b class="mn">${es(en.fmt(t / q))}</b></div>` : "") +
      (horasDados.tot > 0 && t > 0 ? `<div class="ht-l"><span>Parte do total</span><b class="mn">${pctTxt(pct(t, horasDados.tot))}</b></div>` : "") +
      (tipos.length ? `<div class="ht-s">${tipos.map(k => `<div class="ht-t"><i style="background:${COR[k] || "#94a3b8"}"></i><span>${es(k)} <em>${o["q" + k] || 0}</em></span><b class="mn">${num(o[k])}</b></div>`).join("")}</div>` : `<div class="ht-v">Sem vendas nesta hora.</div>`);
  }
  function hrMostrar(c, cx, cy){
    if (!hrTip) { hrTip = document.createElement("div"); hrTip.id = "hrTip"; hrTip.setAttribute("role", "tooltip"); document.body.appendChild(hrTip); }
    const h = c.dataset.h; if (!h) return;
    if (hrAtual !== h) { hrTip.innerHTML = hrDica(h); hrAtual = h; }
    hrTip.classList.add("on");
    // O texto pode estar com zoom (Tamanho do texto): as coordenadas da tela são divididas por ele.
    const z = zLer(), w = hrTip.offsetWidth * z, a = hrTip.offsetHeight * z;
    let x = cx + 14, y = cy - a - 12;
    if (x + w > innerWidth - 8) x = cx - w - 14;
    if (x < 8) x = 8;
    if (y < 8) y = cy + 18;
    if (y + a > innerHeight - 8) y = Math.max(8, innerHeight - a - 8);
    hrTip.style.left = Math.round(x / z) + "px"; hrTip.style.top = Math.round(y / z) + "px";
  }
  function hrEsconder(){ if (hrTip) hrTip.classList.remove("on"); hrAtual = null; }

  // ── Dicas personalizadas (v1.3.0) ───────────────────────────────────────────
  // Todo atributo title dos painéis vira uma dica própria (mesmo visual da dica do gráfico de horas),
  // no lugar da dica padrão do navegador: ao passar o mouse, o title passa para data-tip (o navegador não
  // mostra mais a dele) e a caixa aparece junto do elemento, sempre dentro da tela. Teclado: aparece ao
  // focar com Tab. Elementos só com ícone mantêm o texto como nome acessível (aria-label).
  let dicaEl = null, dicaAlvo = null, dicaTm = 0;
  function dicaPrep(el){
    const t = el.getAttribute("title");
    if (t !== null) {
      if (t.trim()) { el.dataset.tip = t; if (!el.hasAttribute("aria-label") && !el.textContent.trim()) el.setAttribute("aria-label", t); }
      el.removeAttribute("title");
    }
    return el.dataset.tip || "";
  }
  function dicaMostrar(el){
    const txt = dicaPrep(el); if (!txt || !el.isConnected) return;
    if (!dicaEl) { dicaEl = document.createElement("div"); dicaEl.id = "dica"; dicaEl.setAttribute("role", "tooltip"); document.body.appendChild(dicaEl); }
    dicaEl.textContent = txt; dicaEl.classList.add("on");
    const z = zLer(), r = el.getBoundingClientRect(), w = dicaEl.offsetWidth * z, a = dicaEl.offsetHeight * z;
    let x, y;
    if (dicaPonteiro) {
      // v1.6.0: junto da seta do mouse (abaixo e à direita da ponta); perto da borda, vira para o outro lado.
      x = dicaPonteiro.x + 12; y = dicaPonteiro.y + 20;
      if (x + w > innerWidth - 8) x = dicaPonteiro.x - w - 8;
      if (y + a > innerHeight - 8) y = dicaPonteiro.y - a - 10;
    } else {
      // Teclado (Tab): junto do elemento focado.
      x = r.left + r.width / 2 - w / 2; y = r.bottom + 8;
      if (y + a > innerHeight - 8) y = r.top - a - 8;
    }
    y = Math.max(8, Math.min(y, innerHeight - a - 8));
    x = Math.max(8, Math.min(x, innerWidth - w - 8));
    dicaEl.style.left = Math.round(x / z) + "px"; dicaEl.style.top = Math.round(y / z) + "px";
  }
  function dicaEsconder(){ clearTimeout(dicaTm); dicaAlvo = null; if (dicaEl) dicaEl.classList.remove("on"); }
  // Posição da seta do mouse (null = aberta pelo teclado).
  let dicaPonteiro = null;
  function dicaAgendar(el, ms, ponto){
    if (ponto !== undefined) dicaPonteiro = ponto;
    if (el === dicaAlvo) return;
    dicaEsconder();
    if (!el || !dicaPrep(el)) return;
    dicaAlvo = el; dicaTm = setTimeout(() => { if (dicaAlvo === el) dicaMostrar(el); }, ms);
  }

  // ── Detalhe da venda ────────────────────────────────────────────────────────
  function detail(x){
    const en = E(), es = en.esc, fs = formasDe(x), q = qProd(x), nl = prods(x).length;
    const info = [["Tipo", x.t], ["Número", x.n], ["Caixa", x.cx || "—"], ["Hora", x.seg || x.h], ["Vendedor", x.vend], ["Cliente", x.cli || "—"], ["Natureza", x.nat || "—"], ["Itens", qtd(q) + " un em " + nl + " linha" + (nl === 1 ? "" : "s")]];
    if (x.dsc) info.push(["Desconto", x.dsc.pct != null ? pctDesc(x.dsc.pct) + "% (−" + en.fmt(x.dsc.valor) + ")" : "sem valor registrado"]);
    return `<div class="dt-k" style="--c:${COR[x.t] || "#94a3b8"}"><i class="tg">${es(SIG[x.t] || x.t)}</i> Nº ${es(x.n)} · ${es(x.seg || x.h)}</div><h2 class="mn">${es(en.fmt(x.tot))}</h2>` +
      `<div class="dt-g">${info.map(([a, b]) => `<div><small>${a}</small><span>${es(b)}</span></div>`).join("")}</div>` +
      `<div class="dt-s">Itens</div><div class="dt-t">${x.itens.length ? x.itens.map(i => i.aj ? `<div class="dt-p dt-aj"><span>${es(i.d)}</span><b class="mn">${i.tot != null ? num(i.tot) : "—"}</b></div>` : `<div><span class="mn">${qtd(i.q)}×</span><span>${es(i.d)}</span><b class="mn">${i.tot != null ? num(i.tot) : "—"}</b></div>`).join("") : `<div class="dt-p"><span>Sem itens.</span><b></b></div>`}</div>` +
      `<div class="dt-s dt-sc">Pagamento</div><div class="dt-t">${fs.map(f => `<div class="dt-pg"><span>${es(f.k)}</span><b class="mn">${f.v != null ? num(f.v) : "—"}</b></div>`).join("")}<div class="dt-p dt-tot"><span>Total</span><b class="mn">${num(x.tot)}</b></div></div>`;
  }

  // ── Ordenação e filtros extras ──────────────────────────────────────────────
  function ordenar(l){
    const k = ord.k, d = ord.d, nq = qProd;
    const val = {hora: x => x.seg, total: x => x.tot, vendedor: x => x.vend, tipo: x => x.t, numero: x => Number(x.n) || 0, caixa: x => x.cx, cliente: x => x.cli || x.nat, itens: nq, desc: x => x.dsc ? (x.dsc.pct != null ? x.dsc.pct : 0.0001) : 0}[k] || (x => x.seg);
    return l.sort((a, b) => { const A = val(a), B = val(b); const c = typeof A === "number" && typeof B === "number" ? A - B : String(A).localeCompare(String(B), "pt-BR"); return c ? c * d : (a.seg < b.seg ? 1 : -1); });
  }
  function filtroExtra(x){
    if (ext.pg && ignora !== "pg" && !formasDe(x).some(f => f.k === ext.pg)) return false;
    if (ext.cx && ignora !== "cx" && (x.cx || "—") !== ext.cx) return false;
    return true;
  }

  // ── Proibidos: o mesmo filtro [proibidos] do relatório clássico (oculta as vendas com
  // itens da lista de proibidos; NF-e não entra). O botão liga e desliga o termo na busca.
  const PROIB_RE = /\[(proibidos|1p)\]/i;
  function alternarProibidos(){
    const q = $("#q"); if (!q) return; const en = E();
    const lista = window.BUSCA && BUSCA.lista ? BUSCA.lista() : [];
    if (!PROIB_RE.test(q.value) && !lista.length) { en.toast("<b>Proibidos</b> · Nenhum termo proibido cadastrado. Cadastre em Configurações do sistema → Proibidos."); return; }
    q.value = PROIB_RE.test(q.value) ? q.value.replace(/\s*\[(proibidos|1p)\]\s*/ig, " ").trim() : (q.value.trim() + " [proibidos]").trim();
    en.st.q = q.value; en.render();
    en.toast(PROIB_RE.test(q.value) ? "<b>Proibidos</b> · Vendas com itens proibidos ocultas." : "<b>Proibidos</b> · Filtro removido.");
  }

  // ── Logo personalizado (v1.2.0) ─────────────────────────────────────────────
  // Clicar no logo escolhe uma imagem (PNG, JPEG ou ICO, até 2 MB) que vira o logo DOS PAINÉIS
  // (arquivo logo-painel.png, servido em /logo-painel.png). O favicon.png — ícone do sistema, da aba
  // e da bandeja — NÃO é alterado. A troca vale para todos os aparelhos e só é aceita no computador
  // do servidor; nos outros aparelhos o aviso explica o motivo. Configurações → Sistema também
  // permite voltar a usar o ícone do sistema como logo.
  let logoIn = null;
  function escolherLogo(){
    if (!servidorTem("2.28.0")) { E().toast("<b>Logo</b> · " + E().esc(MSG_REINICIAR)); return; }
    if (!logoIn) {
      logoIn = document.createElement("input"); logoIn.type = "file"; logoIn.hidden = true;
      logoIn.accept = "image/png,image/jpeg,image/x-icon,image/vnd.microsoft.icon,.png,.jpg,.jpeg,.ico";
      logoIn.addEventListener("change", () => { const f = logoIn.files && logoIn.files[0]; logoIn.value = ""; if (f) enviarLogo(f); });
      document.body.appendChild(logoIn);
    }
    logoIn.click();
  }
  async function enviarLogo(f){
    const en = E();
    if (!f.size) { en.toast("<b>Logo</b> · O arquivo escolhido está vazio."); return; }
    if (f.size > 2 * 1024 * 1024) { en.toast("<b>Logo</b> · Arquivo muito grande (máximo de 2 MB)."); return; }
    let r = null, j = null;
    try { r = await fetch("/api/upload-logo", {method: "POST", headers: {"Content-Type": "application/octet-stream"}, body: f, credentials: "same-origin"}); } catch (e) { r = null; }
    if (!r) { en.toast("<b>Logo</b> · Sem conexão com o servidor. Tente novamente."); return; }
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok || !j || !j.ok) { en.toast("<b>Logo</b> · " + en.esc(erroDe(r, j, "Não foi possível trocar o logo."))); return; }
    atualizarLogos(); en.toast("<b>Logo</b> · Logo do painel atualizado. O ícone do sistema não foi alterado.");
  }
  async function logoPadrao(){
    const en = E(); let r = null, j = null;
    try { r = await fetch("/api/remover-logo", {method: "POST", credentials: "same-origin"}); } catch (e) { r = null; }
    if (!r) { en.toast("<b>Logo</b> · Sem conexão com o servidor. Tente novamente."); return; }
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok || !j || !j.ok) { en.toast("<b>Logo</b> · " + en.esc(erroDe(r, j, "Não foi possível alterar o logo."))); return; }
    atualizarLogos(); en.toast("<b>Logo</b> · O painel voltou a usar o ícone do sistema como logo.");
  }
  function atualizarLogos(){
    const v = "/logo-painel.png?v=" + Date.now();
    $$(".logo").forEach(l => {
      let i = l.querySelector("img");
      if (!i) { i = document.createElement("img"); i.alt = ""; l.appendChild(i); }
      i.onerror = () => { l.classList.add("semImg"); i.remove(); };
      l.classList.remove("semImg"); i.src = v;
    });
  }
  function prepararLogos(){
    $$(".logo").forEach(l => { l.setAttribute("role", "button"); l.tabIndex = 0; l.title = "Clique para trocar o logo"; l.setAttribute("aria-label", "Trocar o logo"); });
  }

  // ── Botão de limpar a busca (v1.5.0) ────────────────────────────────────────
  // Com texto na busca, aparece um X (no lugar do atalho "/") que limpa o campo e a lista. Também
  // acompanha as mudanças feitas por Proibidos, Limpar filtros e Esc (pRodape chama buscaX()).
  function buscaX(){
    const q = $("#q"); if (!q) return;
    const lb = q.closest(".busca") || q.parentNode; if (lb) lb.classList.toggle("temQ", !!q.value);
  }
  function prepararBusca(){
    const q = $("#q"); if (!q) return;
    const lb = q.closest(".busca") || q.parentNode; if (!lb || lb.querySelector(".buscaX")) return;
    const x = document.createElement("button");
    x.type = "button"; x.className = "buscaX"; x.title = "Limpar a busca"; x.setAttribute("aria-label", "Limpar a busca");
    x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    const kbd = lb.querySelector("kbd"); if (kbd) lb.insertBefore(x, kbd); else lb.appendChild(x);
    x.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      q.value = ""; E().st.q = ""; E().render(); buscaX(); q.focus({preventScroll: true});
    });
    q.addEventListener("input", buscaX);
    buscaX();
  }

  // ── Interação ───────────────────────────────────────────────────────────────
  function aba(n){ document.body.dataset.aba = n; $$("button[data-aba]").forEach(b => b.classList.toggle("on", b.dataset.aba === n)); try { sessionStorage.setItem("fdb_aba", n); } catch (e) {} }
  function intro(){
    esqueletos(); temaInit();
    let a = "vendas"; try { a = sessionStorage.getItem("fdb_aba") || "vendas"; } catch (e) {}
    if (!["resumo", "vendas", "pagtos", "equipe"].includes(a)) a = "vendas"; aba(a); prepararLogos(); prepararBusca();
    document.addEventListener("click", e => {
      const o = e.target.closest("[data-ord]"); if (o) { const k = o.dataset.ord; if (ord.k === k) ord.d = -ord.d; else { ord.k = k; ord.d = (k === "vendedor" || k === "tipo" || k === "cliente") ? 1 : -1; } marcaOrd(); E().render(); return; }
      const p = e.target.closest("[data-pg]"); if (p) { ext.pg = ext.pg === p.dataset.pg ? null : p.dataset.pg; E().render(); return; }
      const c = e.target.closest("[data-cx]"); if (c) { ext.cx = ext.cx === c.dataset.cx ? null : c.dataset.cx; E().render(); return; }
      const ab = e.target.closest("button[data-aba]"); if (ab) { aba(ab.dataset.aba); return; }
      const l = e.target.closest("[data-limpa]"); if (l) { const k = l.dataset.limpa, q = $("#q");
        if (k === "tipo" || k === "tudo") { const b = $('[data-tipo="todos"]'); if (b) b.click(); }
        if (k === "vend" || k === "tudo") { const b = $('#vends [data-vend=""]'); if (b) b.click(); else E().st.vend = null; }
        if (k === "pg" || k === "tudo") ext.pg = null;
        if (k === "cx" || k === "tudo") ext.cx = null;
        if ((k === "q" || k === "tudo") && q) { q.value = ""; E().st.q = ""; }
        if (k === "tudo") { ord.k = "hora"; ord.d = -1; marcaOrd(); if (q) q.focus({preventScroll: true}); }
        E().render(); return; }
      const pb = e.target.closest("#btnProib"); if (pb) { alternarProibidos(); return; }
      if (e.target.closest(".logo")) { escolherLogo(); return; }
    });
    // Dica do gráfico de horas: mouse (passar por cima) e toque (tocar na barra; tocar fora fecha).
    document.addEventListener("pointermove", e => { if (e.pointerType === "touch") return; const c = e.target.closest && e.target.closest(".hr-c"); if (c) hrMostrar(c, e.clientX, e.clientY); else if (hrAtual) hrEsconder(); }, {passive: true});
    document.addEventListener("pointerdown", e => { if (e.pointerType !== "touch") return; const c = e.target.closest && e.target.closest(".hr-c"); if (c) hrMostrar(c, e.clientX, e.clientY); else hrEsconder(); }, {passive: true});
    document.addEventListener("scroll", hrEsconder, {passive: true, capture: true});
    // Avatar do vendedor: escolhe a foto sem filtrar pela pessoa (captura, antes do clique da linha).
    document.addEventListener("click", e => {
      const av = e.target.closest && e.target.closest(".vd-av[data-foto-vend]");
      if (av) { e.preventDefault(); e.stopPropagation(); cliqueAvatar(av); return; }
      if (fotoMenu && !fotoMenu.contains(e.target)) fecharFotoMenu();
    }, true);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && fotoMenu) { fecharFotoMenu(); return; }
      const av = document.activeElement && document.activeElement.closest && document.activeElement.closest(".vd-av[data-foto-vend]");
      if (av && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); cliqueAvatar(av); }
    }, true);
    carregarFotos();
    // Dicas personalizadas no lugar do title do navegador (mouse e teclado).
    // Avatar com foto: a foto ampliada substitui a dica de texto.
    document.addEventListener("pointermove", e => {
      if (e.pointerType === "touch") return;
      const av = e.target.closest && e.target.closest(".vd-av.comFoto");
      if (av) { dicaEsconder(); zoomFoto(av, e.clientX, e.clientY); } else if (fotoZoomAlvo) zoomFotoFechar();
    }, {passive: true});
    document.addEventListener("scroll", zoomFotoFechar, {passive: true, capture: true});
    document.addEventListener("pointerover", e => { if (e.pointerType === "touch") return; const avF = e.target.closest && e.target.closest(".vd-av.comFoto"); if (avF) { dicaPrep(avF); return; } dicaAgendar(e.target.closest ? e.target.closest("[title],[data-tip]") : null, 380, {x: e.clientX, y: e.clientY}); }, {passive: true});
    // A seta continua andando até a dica abrir: ela abre onde a seta estiver nesse momento.
    document.addEventListener("pointermove", e => { if (e.pointerType !== "touch" && dicaAlvo && dicaPonteiro && !(dicaEl && dicaEl.classList.contains("on"))) dicaPonteiro = {x: e.clientX, y: e.clientY}; }, {passive: true});
    document.addEventListener("focusin", e => { const el = e.target.closest && e.target.closest("[title],[data-tip]"); if (el && el.matches(":focus-visible")) dicaAgendar(el, 120, null); });
    document.addEventListener("focusout", dicaEsconder);
    document.addEventListener("pointerdown", dicaEsconder, {passive: true});
    document.addEventListener("keydown", e => { if (e.key === "Escape") dicaEsconder(); });
    document.addEventListener("scroll", dicaEsconder, {passive: true, capture: true});
    // Teclado: ↑ ↓ escolhem a linha, Enter abre, / vai para a busca, Esc limpa a busca.
    let sel = -1; const linhas = () => $$("#feed .lv:not([data-saindo])");
    document.addEventListener("keydown", e => {
      if ($("#ov.on") || (menu && menu.classList.contains("on")) || (cfgM && cfgM.classList.contains("on"))) return; const q = $("#q");
      if ((e.key === "Enter" || e.key === " ") && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("logo")) { e.preventDefault(); escolherLogo(); return; }
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
    const b = $("#btnTema"); if (!b) return; fecharCfg();
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
    posMenu(menu, b);
    menu.classList.add("on"); b.setAttribute("aria-expanded", "true");
    const sel = menu.querySelector('[aria-checked="true"]') || menu.querySelector(".tmCard"); if (sel) sel.focus({preventScroll: true});
  }
  // ── Configurações do painel (v1.0.2): como no relatório clássico, o desempenho fica em
  // Configurações → Nesta tela (fora do cabeçalho). Também leva às configurações do sistema
  // (/config, que volta para este painel) e ao relatório clássico.
  let cfgM = null;
  const PERF_EST = () => { const en = E(), pref = en.perfPref ? en.perfPref() : "auto", lv = en.leve();
    return pref === "leve" ? "Leve (escolhido)" : pref === "completo" ? "Completo (escolhido)" : "Automático — " + (lv ? "leve" : "completo"); };
  // Tamanho do texto: 80% a 140%, salvo separado no celular e no computador (mesmas chaves
  // do relatório clássico: fdb_zoom_mob / fdb_zoom_pc).
  const ZOOM = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
  const zCel = () => { try { return matchMedia("(max-width: 680px)").matches; } catch (e) { return false; } };
  const zChave = () => zCel() ? "fdb_zoom_mob" : "fdb_zoom_pc";
  function zLer(){ let v = 1; try { v = parseFloat(localStorage.getItem(zChave())); } catch (e) {} return ZOOM.indexOf(v) >= 0 ? v : 1; }
  function zAplicar(){ const z = zLer(); if (z === 1) document.documentElement.style.removeProperty("--zoom"); else document.documentElement.style.setProperty("--zoom", String(z)); }
  function zPasso(d){
    const at = zLer(), i = ZOOM.indexOf(at), n = d === 0 ? 1 : ZOOM[Math.max(0, Math.min(ZOOM.length - 1, (i < 0 ? 2 : i) + (d > 0 ? 1 : -1)))];
    try { if (n === 1) localStorage.removeItem(zChave()); else localStorage.setItem(zChave(), String(n)); } catch (e) {}
    zAplicar(); cfgEstado(); if (cfgM && cfgM.classList.contains("on")) posMenu(cfgM, $("#btnCfg"));
  }
  zAplicar(); addEventListener("resize", zAplicar);
  // Atualização: mesma opção do relatório clássico ("fdb_recarga_auto"; ligada por padrão).
  const recLigada = () => { try { return localStorage.getItem("fdb_recarga_auto") !== "0"; } catch (e) { return true; } };
  function cfgEstado(){
    if (!cfgM) return;
    const e = cfgM.querySelector(".cfgEst"); if (e) e.textContent = PERF_EST();
    const r = cfgM.querySelector("#cfgRec"); if (r) r.checked = recLigada();
    const re = cfgM.querySelector(".cfgRecEst"); if (re) re.textContent = recLigada() ? "Automática" : "Manual";
    const z = zLer(), ze = cfgM.querySelector(".cfgZEst"); if (ze) ze.textContent = Math.round(z * 100) + "%";
    cfgM.querySelectorAll("[data-z]").forEach(b => { const d = Number(b.dataset.z); b.disabled = (d < 0 && z <= ZOOM[0]) || (d > 0 && z >= ZOOM[ZOOM.length - 1]); if (!d) b.setAttribute("aria-pressed", z === 1 ? "true" : "false"); });
  }
  function fecharCfg(){ if (!cfgM) return; cfgM.classList.remove("on"); const b = $("#btnCfg"); if (b) b.setAttribute("aria-expanded", "false"); }
  function montarCfg(){
    if (cfgM) return cfgM;
    const es = E().esc, voltar = encodeURIComponent(location.pathname + location.search);
    cfgM = document.createElement("div"); cfgM.id = "cfgMenu"; cfgM.className = "tmMenu cfgMenu"; cfgM.setAttribute("role", "dialog"); cfgM.setAttribute("aria-label", "Configurações");
    cfgM.innerHTML =
      `<div class="tmSec"><div class="tmCab"><b>Nesta tela</b><span>Vale só para este aparelho.</span></div>` +
      `<div class="cfgLin"><div class="cfgRot"><b>Desempenho</b><span class="cfgEst"></span></div><div data-perf-ctl></div>` +
      `<p class="cfgDica">Leve: sem animações, desfoque nem sombras pesadas — indicado para computadores, notebooks e celulares de menor desempenho. A opção Automático identifica o aparelho e escolhe o modo adequado.</p></div>` +
      `<div class="cfgLin"><div class="cfgRot"><b>Atualização</b><span class="cfgRecEst"></span></div><label class="cfgChk"><input type="checkbox" id="cfgRec"><span>Recarregar o painel ao detectar mudanças</span></label>` +
      `<p class="cfgDica">Ligado: a cada nova venda, a página é recarregada como no F5 — a busca, os filtros e as janelas abertas são limpos. Desligado: as novas vendas são incluídas automaticamente, sem recarregar — filtros, busca e rolagem são mantidos.</p></div>` +
      `<div class="cfgLin"><div class="cfgRot"><b>Tamanho do texto</b><span class="cfgZEst"></span></div><div class="cfgZ" role="group" aria-label="Tamanho do texto"><button type="button" data-z="-1" aria-label="Diminuir o texto">A−</button><button type="button" data-z="0" aria-label="Tamanho padrão">Padrão</button><button type="button" data-z="1" aria-label="Aumentar o texto">A+</button></div>` +
      `<p class="cfgDica">Os mesmos ajustes do relatório clássico, válidos somente para este aparelho.</p></div></div>` +
      `<div class="tmSec"><div class="tmCab"><b>Sistema</b></div><div class="cfgLinks">` +
      `<a href="/config?voltar=${voltar}">Configurações do sistema</a><a class="cfgCl" href="${es(urlClassico())}">Abrir o relatório clássico</a>` +
      `<div class="cfgLogo" title="O logo vale só para os painéis e só pode ser trocado no computador do servidor. O ícone do sistema (aba e bandeja) não muda.">` +
      `<button type="button" data-logo="trocar">Trocar o logo</button><button type="button" data-logo="padrao">Logo padrão</button></div></div></div>`;
    document.body.appendChild(cfgM);
    cfgM.addEventListener("click", e => { const z = e.target.closest("[data-z]"); if (z) { e.stopPropagation(); zPasso(Number(z.dataset.z)); return; }
      const lg = e.target.closest("[data-logo]"); if (lg) { e.stopPropagation(); fecharCfg(); if (lg.dataset.logo === "trocar") escolherLogo(); else logoPadrao(); } });
    cfgM.querySelector("#cfgRec").addEventListener("change", e => {
      try { localStorage.setItem("fdb_recarga_auto", e.target.checked ? "1" : "0"); } catch (er) {}
      cfgEstado(); E().toast(e.target.checked ? "<b>Atualização</b> · A cada nova venda, a página será recarregada e os filtros serão limpos (como no F5)." : "<b>Atualização</b> · As novas vendas continuarão sendo incluídas, sem recarregar a página.");
    });
    E().perfCtl(); cfgEstado();
    return cfgM;
  }
  function posMenu(m, b){
    if (!m || !b) return;
    const z = zLer(), r = b.getBoundingClientRect(), estreito = innerWidth <= 820;
    m.style.top = Math.round((r.bottom + 8) / z) + "px";
    m.style.left = estreito ? Math.round(8 / z) + "px" : "auto"; m.style.right = estreito ? Math.round(8 / z) + "px" : Math.round(Math.max(8, innerWidth - r.right) / z) + "px";
    m.style.maxHeight = Math.round(Math.max(200, innerHeight - r.bottom - 20) / z) + "px";
    m.style.width = estreito ? "auto" : "";
  }
  function abrirCfg(){
    const b = $("#btnCfg"); if (!b) return; fecharMenu();
    montarCfg(); posMenu(cfgM, b); cfgEstado(); cfgM.classList.add("on"); b.setAttribute("aria-expanded", "true");
    const f = cfgM.querySelector('[aria-pressed="true"]') || cfgM.querySelector("button,a"); if (f) f.focus({preventScroll: true});
  }
  function cfgInit(){
    const b = $("#btnCfg"); if (!b) return;
    b.addEventListener("click", e => { e.stopPropagation(); if (cfgM && cfgM.classList.contains("on")) fecharCfg(); else abrirCfg(); });
    document.addEventListener("click", e => { if (cfgM && cfgM.classList.contains("on") && !cfgM.contains(e.target) && !e.target.closest("[data-perf-op]")) fecharCfg(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && cfgM && cfgM.classList.contains("on")) { e.stopPropagation(); fecharCfg(); b.focus(); } }, true);
    addEventListener("resize", fecharCfg);
  }

  function temaInit(){
    if (TM.atual && ehPainel(TM.atual)) salvarPainel(TM.atual); // o painel aberto passa a ser o escolhido
    cfgInit();
    const b = $("#btnTema"); if (!b) return;
    b.addEventListener("click", e => { e.stopPropagation(); if (menu && menu.classList.contains("on")) fecharMenu(); else abrirMenu(); });
    document.addEventListener("click", e => { if (menu && menu.classList.contains("on") && !menu.contains(e.target)) fecharMenu(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && menu && menu.classList.contains("on")) { e.stopPropagation(); fecharMenu(); b.focus(); } }, true);
    addEventListener("resize", fecharMenu);
  }

  window.PAINEL = {fotosMudaram: carregarFotos, recarregar: recLigada, limite: 400, card, vend, detail, ordenar, filtroExtra, intro, after, perfMudou: l => { cfgEstado(); if (cfg.perfMudou) cfg.perfMudou(l); }};
})();
