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
  const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const limpa = s => norm(s).replace(/[!?.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const fill = (t, cfg) => (t || '').replace(/\{nome\}/g, cfg.nome || '');
  const SAUDACOES = ['oi','ola','menu','inicio','bom dia','boa tarde','boa noite','opa','eae','e ai','0','voltar'];
  const RE_SAUDA = /^(?:oi+e*|ola+|opa+|eae+|e ai|alo+|bom dia|boa tarde|boa noite|menu|inicio|voltar)\b/;
  const RE_OBRIGADO = /\b(?:obrigad[oa]s?|obg|brigad[oa]|valeu|vlw|agradeco|tchau|ate mais|ate logo)\b/;
  const RE_OK = /^(?:ok+|okay|blz|beleza|certo|ta bom|show|perfeito|entendi|combinado|joia)$/;
  const STOP = ['para','como','com','meu','minha','meus','minhas','falar','consultar','pedir','ver','acompanhar','quero','sobre','mais','voce','voces'];
  const DESPEDIDA = 'Por nada! 😊 Precisando, é só chamar.';
  const OCULTAR = 'cliente, nome, telefone, celular, cpf, email';

  function tabela(csv){
    const lines = (csv || '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) { const v = []; v.cols = []; return v; }
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const raw = lines[0].split(sep).map(x => x.trim()), head = raw.map(norm);
    const rows = lines.slice(1).map(l => { const c = l.split(sep), o = {}; head.forEach((h,i) => o[h] = (c[i] || '').trim()); return o; });
    rows.cols = raw.map((r,i) => ({ k: head[i], label: r.charAt(0).toUpperCase() + r.slice(1) }));
    return rows;
  }
  const conf = cfg => Object.assign({ termo: 'OS', gatilhos: 'os', chave: 'os', ocultar: OCULTAR }, cfg.consulta || {});
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const soNum = s => (s || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  function dentroHorario(cfg, agora){
    const h = cfg.horario; if (!h || !h.abre || !h.fecha) return true;
    if (!(h.dias || []).includes(agora.getDay())) return false;
    const fecha = (agora.getDay() === 6 && h.fechaSab) ? h.fechaSab : h.fecha;
    const m = agora.getHours()*60 + agora.getMinutes();
    const [a1,a2] = h.abre.split(':').map(Number), [f1,f2] = fecha.split(':').map(Number);
    return m >= a1*60+a2 && m < f1*60+f2;
  }
  const menu = cfg => (cfg.menu || []).length ? cfg.menu.map((it,i) => `*${i+1}* — ${it.titulo}`).join('\n') + '\n\nDigite o número da opção.' : '';
  // devolve { achou, txt }; colunas em "ocultar" nunca saem na resposta
  function buscar(cfg, num){
    const C = conf(cfg), rows = tabela(cfg.planilhaCSV), ch = norm(C.chave), alvo = soNum(num);
    const r = rows.find(x => soNum(x[ch]) === alvo && alvo !== '');
    if (!r) return { achou: false, txt: `Não encontrei ${C.termo} *${num}*. Confira o número no seu comprovante.` };
    const fora = (C.ocultar || '').split(',').map(norm).filter(Boolean);
    const linhas = rows.cols.filter(c => c.k !== ch && r[c.k] && !fora.includes(c.k)).map(c => `${c.label}: ${c.k === 'status' ? '*' + r[c.k] + '*' : r[c.k]}`);
    return { achou: true, txt: `📋 *${C.termo} ${r[ch]}*\n` + (linhas.length ? linhas.join('\n') : 'Ainda sem atualização.') };
  }
  // "qual o endereço?" abre a opção "Endereço e horário" sem o cliente digitar o número
  const palavrasDe = s => limpa(s).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(w => w.length >= 4 && !STOP.includes(w));
  function opcaoPorTitulo(cfg, t){
    const ws = t.split(' '); let melhor = -1, pontos = 0;
    (cfg.menu || []).forEach((it,i) => {
      const n = palavrasDe(it.titulo).filter(w => ws.some(x => x === w || x === w + 's' || x + 's' === w)).length;
      if (n > pontos) { pontos = n; melhor = i; }
    });
    return melhor;
  }

  function responder(texto, cfg, sessao = {}, agora = new Date(), opts = {}){
    const s = { ...sessao }, out = [], t = limpa(texto).replace(/^(?:opcao|op|numero) (?=\d+$)/, '');   // "opção 2" = "2"
    const fim = () => ({ respostas: out.filter(x => x && x.trim()), sessao: s });
    const itens = cfg.menu || [], regras = cfg.palavras || [];
    const saudar = () => { s.iniciado = true; s.etapa = null; s.tent = 0; out.push(fill(cfg.saudacao, cfg), menu(cfg)); return fim(); };
    const abrir = i => {
      const it = itens[i]; s.iniciado = true; s.etapa = null; s.tent = 0;
      if (it.tipo === 'os' || it.tipo === 'consulta') s.etapa = 'consulta';
      if (it.tipo === 'humano') { s.humano = true; s.avisoHumano = true; }
      out.push(fill(it.texto, cfg));
      if (it.tipo === 'texto') out.push('Digite *menu* para voltar.');
      return fim();
    };
    const consultar = num => {
      const r = buscar(cfg, num); s.iniciado = true;
      if (r.achou) { s.etapa = null; s.tent = 0; out.push(r.txt, 'Digite *menu* para mais opções.'); return fim(); }
      s.tent = (s.tent || 0) + 1;
      if (s.tent >= 2) { s.etapa = null; s.tent = 0; out.push(r.txt, 'Digite *menu* para ver as opções ou falar com um atendente.'); }
      else { s.etapa = 'consulta'; out.push(r.txt + ' Pode enviar de novo, ou digite *menu*.'); }
      return fim();
    };

    if (!s.avisoHorario && !opts.ignorarHorario && !dentroHorario(cfg, agora)) { out.push(fill((cfg.horario || {}).msgFora, cfg)); s.avisoHorario = true; }

    // atendimento humano: robô fica quieto
    if (s.humano) {
      if (t === 'menu') { s.humano = false; s.avisoHumano = false; return saudar(); }
      if (!s.avisoHumano) { out.push('Mensagem registrada. Um atendente responde em breve. (Digite *menu* para voltar ao robô)'); s.avisoHumano = true; }
      return fim();
    }

    // consulta direta: "os 1042", "os1042", "o.s. 1042", "pedido 501"
    const C = conf(cfg);
    const gat = (C.gatilhos || '').split(',').map(norm).filter(Boolean).map(escRe).join('|');
    const mOS = gat ? t.replace(/\bo s\b/g, 'os').match(new RegExp('\\b(?:' + gat + ')(?:\\b\\D{0,6}|\\s*)(\\d{2,})')) : null;
    if (mOS) return consultar(mOS[1]);

    // esperando o número depois de escolher a opção de consulta
    const esperando = s.etapa === 'consulta';
    if (esperando) {
      const num = (t.match(/\d+/) || [])[0];
      const ehOpcao = num && /^\d$/.test(t) && itens[Number(t) - 1];
      if (num && !ehOpcao) return consultar(num);
    }

    // saudação / menu
    if (SAUDACOES.includes(t)) return saudar();

    // número: opção do menu, ou o próprio número de consulta enviado sozinho
    if (/^\d+$/.test(t)) {
      if (itens[Number(t) - 1]) return abrir(Number(t) - 1);
      if (t.length >= 3) return consultar(t);
    }

    // palavras-chave (palavra inteira, aceita plural)
    const tt = ' ' + t + ' ';
    for (const r of regras) {
      const ks = (r.palavras || '').split(',').map(limpa).filter(Boolean);
      if (ks.some(k => tt.includes(' ' + k + ' ') || tt.includes(' ' + k + 's '))) { s.iniciado = true; s.etapa = null; s.tent = 0; out.push(fill(r.resposta, cfg)); return fim(); }
    }

    // pergunta que cita uma opção do menu
    const op = opcaoPorTitulo(cfg, t);
    if (op >= 0) return abrir(op);

    // ainda esperando o número e nada acima serviu
    if (esperando) {
      s.tent = (s.tent || 0) + 1;
      if (s.tent >= 2) { s.etapa = null; s.tent = 0; out.push(fill(cfg.naoEntendi, cfg), menu(cfg)); }
      else out.push(`Me envie só o *número* (${C.termo}). Se não tiver, digite *menu*.`);
      return fim();
    }

    if (RE_OBRIGADO.test(t)) { s.iniciado = true; out.push(fill(cfg.despedida || DESPEDIDA, cfg)); return fim(); }
    if (RE_SAUDA.test(t)) return saudar();
    if (s.iniciado && (RE_OK.test(t) || !/[a-z0-9]/.test(t))) return fim();   // "ok", 👍: não responde

    // 1º contato sem match → saudação; depois → não entendi
    if (!s.iniciado) return saudar();
    out.push(fill(cfg.naoEntendi, cfg), menu(cfg));
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
