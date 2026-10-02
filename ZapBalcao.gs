/* =====================================================================
   ZAP BALCÃO — Adaptador MODO ECONÔMICO (AutoResponder for WA + Apps Script)
   NicoShake Labs
   ---------------------------------------------------------------------
   Planilha do cliente (abas):
     Config → célula A1 = JSON exportado do editor Zap Balcão
     Dados  → tabela de consulta (1ª linha = cabeçalho). Opcional:
              se vazia, usa a planilha que veio no JSON.
     Log    → criada sozinha (se LOG_ATIVO = true)
   Implantar: Implantar > Nova implantação > App da Web
              Executar como: Eu · Acesso: Qualquer pessoa
   URL no AutoResponder: <URL do app da Web>?k=<TOKEN>
   ===================================================================== */

const TOKEN = 'TROQUE-ESTE-TOKEN';   // senha simples da URL
const LOG_ATIVO = true;              // grava conversas na aba Log
const SESSAO_SEG = 6 * 60 * 60;      // memória da conversa (máx. 6h)
const DELAY_SEG = 2;                 // pausa entre mensagens (parece humano)

/* ================= MOTOR (independente do canal) =================
   responder(texto, cfg, sessao, agora, opts) -> { respostas:[...], sessao }
   O mesmo motor será usado pelos adaptadores AutoResponder e Cloud API. */
const Motor = (() => {
  const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const fill = (t, cfg) => (t || '').replace(/\{nome\}/g, cfg.nome || '');
  const SAUDACOES = ['oi','ola','menu','inicio','bom dia','boa tarde','boa noite','opa','eae','e ai','0','voltar'];

  function tabela(csv){
    const lines = (csv || '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) { const v = []; v.cols = []; return v; }
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const raw = lines[0].split(sep).map(x => x.trim()), head = raw.map(norm);
    const rows = lines.slice(1).map(l => { const c = l.split(sep), o = {}; head.forEach((h,i) => o[h] = (c[i] || '').trim()); return o; });
    rows.cols = raw.map((r,i) => ({ k: head[i], label: r.charAt(0).toUpperCase() + r.slice(1) }));
    return rows;
  }
  const conf = cfg => Object.assign({ termo: 'OS', gatilhos: 'os', chave: 'os' }, cfg.consulta || {});
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function dentroHorario(cfg, agora){
    const h = cfg.horario; if (!h || !h.abre || !h.fecha) return true;
    if (!(h.dias || []).includes(agora.getDay())) return false;
    const m = agora.getHours()*60 + agora.getMinutes();
    const [a1,a2] = h.abre.split(':').map(Number), [f1,f2] = h.fecha.split(':').map(Number);
    return m >= a1*60+a2 && m < f1*60+f2;
  }
  const menu = cfg => cfg.menu.map((it,i) => `*${i+1}* — ${it.titulo}`).join('\n') + '\n\nDigite o número da opção.';
  function buscar(cfg, num){
    const C = conf(cfg), rows = tabela(cfg.planilhaCSV), ch = norm(C.chave);
    const r = rows.find(x => (x[ch] || '').replace(/\D/g,'') === num);
    if (!r) return `Não encontrei ${C.termo} *${num}*. Confira o número no seu comprovante.`;
    const linhas = rows.cols.filter(c => c.k !== ch && r[c.k]).map(c => `${c.label}: ${c.k === 'status' ? '*' + r[c.k] + '*' : r[c.k]}`);
    return `📋 *${C.termo} ${r[ch]}*\n` + linhas.join('\n');
  }

  function responder(texto, cfg, sessao = {}, agora = new Date(), opts = {}){
    const s = { ...sessao }, out = [], t = norm(texto).replace(/[!?.,;:]+/g,' ').replace(/\s+/g,' ').trim();
    const fim = () => ({ respostas: out, sessao: s });

    if (!s.avisoHorario && !opts.ignorarHorario && !dentroHorario(cfg, agora)) { out.push(fill(cfg.horario.msgFora, cfg)); s.avisoHorario = true; }

    // atendimento humano: robô fica quieto
    if (s.humano) {
      if (t === 'menu') { s.humano = false; s.avisoHumano = false; out.push(fill(cfg.saudacao, cfg), menu(cfg)); }
      else if (!s.avisoHumano) { out.push('Mensagem registrada. Um atendente responde em breve. (Digite *menu* para voltar ao robô)'); s.avisoHumano = true; }
      return fim();
    }

    // consulta na planilha (direta "os 1042"/"pedido 501" ou após escolher a opção)
    const C = conf(cfg);
    const gat = (C.gatilhos || '').split(',').map(norm).filter(Boolean).map(escRe).join('|');
    const mOS = gat ? t.match(new RegExp('\\b(?:' + gat + ')\\b\\D{0,6}(\\d{2,})')) : null;
    if (mOS || s.etapa === 'consulta') {
      const num = mOS ? mOS[1] : (t.match(/\d+/) || [])[0];
      s.iniciado = true;
      if (num) { s.etapa = null; out.push(buscar(cfg, num), 'Digite *menu* para mais opções.'); return fim(); }
      if (!SAUDACOES.includes(t)) { out.push(`Me envie só o *número* (${C.termo}).`); return fim(); }
      s.etapa = null;
    }

    // saudação / menu
    if (SAUDACOES.includes(t)) { s.iniciado = true; s.etapa = null; out.push(fill(cfg.saudacao, cfg), menu(cfg)); return fim(); }

    // opção do menu
    if (/^\d+$/.test(t)) {
      const it = cfg.menu[Number(t) - 1];
      if (it) {
        s.iniciado = true;
        if (it.tipo === 'os' || it.tipo === 'consulta') s.etapa = 'consulta';
        if (it.tipo === 'humano') { s.humano = true; s.avisoHumano = true; }
        out.push(fill(it.texto, cfg));
        if (it.tipo === 'texto') out.push('Digite *menu* para voltar.');
        return fim();
      }
    }

    // palavras-chave
    for (const r of cfg.palavras) {
      const ks = (r.palavras || '').split(',').map(norm).filter(Boolean);
      if (ks.some(k => t.includes(k))) { s.iniciado = true; out.push(fill(r.resposta, cfg)); return fim(); }
    }

    // 1º contato sem match → saudação; depois → não entendi
    if (!s.iniciado) { s.iniciado = true; out.push(fill(cfg.saudacao, cfg), menu(cfg)); }
    else out.push(fill(cfg.naoEntendi, cfg), menu(cfg));
    return fim();
  }
  return { responder, tabela, norm, conf };
})();

/* ================= ADAPTADOR ================= */
function doPost(e) {
  try {
    if (!e || !e.parameter || e.parameter.k !== TOKEN) return saida_([]);
    const data = JSON.parse(e.postData.contents || '{}');
    const q = data.query || {};
    if (!q.sender || !q.message || q.isGroup) return saida_([]);   // ignora grupos

    const cfg = lerConfig_();
    if (!cfg) return saida_(['⚠️ Bot sem configuração (aba Config, célula A1).']);

    const cache = CacheService.getScriptCache();
    const chave = 'sess_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, q.sender));
    const sessao = JSON.parse(cache.get(chave) || '{}');

    const r = Motor.responder(q.message, cfg, sessao, new Date(), {});
    cache.put(chave, JSON.stringify(r.sessao), SESSAO_SEG);

    if (LOG_ATIVO) logar_(q.sender, q.message, r.respostas);
    return saida_(r.respostas);
  } catch (err) {
    console.error(err);
    return saida_([]);   // em erro, fica quieto (não manda lixo pro cliente)
  }
}

function doGet() {
  return ContentService.createTextOutput('Zap Balcão OK ✅');
}

function saida_(msgs) {
  const replies = msgs.filter(Boolean).map((m, i) => ({ message: m, delay: i === 0 ? 1 : DELAY_SEG }));
  return ContentService.createTextOutput(JSON.stringify({ replies })).setMimeType(ContentService.MimeType.JSON);
}

function lerConfig_() {
  const cache = CacheService.getScriptCache();
  const ss = SpreadsheetApp.getActive();
  let cfgTxt = cache.get('cfg');
  if (!cfgTxt) {
    const aba = ss.getSheetByName('Config');
    if (!aba) return null;
    cfgTxt = String(aba.getRange('A1').getValue() || '');
    if (!cfgTxt.trim()) return null;
    if (cfgTxt.length < 90000) cache.put('cfg', cfgTxt, 60);   // 1 min de cache
  }
  const cfg = JSON.parse(cfgTxt);
  const dados = ss.getSheetByName('Dados');
  if (dados && dados.getLastRow() > 1) {
    cfg.planilhaCSV = dados.getDataRange().getDisplayValues()
      .map(l => l.map(c => String(c).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  }
  return cfg;
}

function logar_(quem, msg, resp) {
  const ss = SpreadsheetApp.getActive();
  const aba = ss.getSheetByName('Log') || ss.insertSheet('Log');
  if (aba.getLastRow() === 0) aba.appendRow(['Data', 'Contato', 'Mensagem', 'Resposta do bot']);
  aba.appendRow([new Date(), quem, msg, resp.join('\n---\n')]);
}

/* ================= TESTE (rode no editor do Apps Script) ================= */
function testar() {
  const cfg = lerConfig_();
  if (!cfg) { console.log('Sem Config!'); return; }
  let s = {};
  ['oi', '1', '1042', 'garantia'].forEach(m => {
    const r = Motor.responder(m, cfg, s, new Date(), { ignorarHorario: true });
    s = r.sessao;
    console.log('> ' + m + '\n' + r.respostas.join('\n---\n'));
  });
}
