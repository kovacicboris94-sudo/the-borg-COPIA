/* =====================================================================
   CLAUDE NEL BORGO (Profilo -> "Claude nel borgo")
   Ognuno puo' far entrare il SUO Claude (claude.ai, app di Claude, Claude Code)
   come compagno: un avatar con 🤖 che lo segue, legge la chat e parla.
   Niente API a pagamento: Claude si collega al server di gioco come connettore
   MCP (server/claude-mcp/) e lavora dentro l'abbonamento di chi lo usa.
   Qui si crea il codice (RPC claude_codice, vale 12 ore) da dare a Claude
   e si scollega (RPC claude_revoca). Serve una stanza amici sul server Nakama.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, G = window.Gioco;
  const box = document.getElementById('claude-box');
  if (!B || !G || !box) return;
  const CHIAVE = 'borg_claude';

  function indirizzoMcp(server) {
    const s = String(server || '').trim().replace(/\/+$/, '');
    const sicuro = /^https:\/\//i.test(s) || (!/^http:\/\//i.test(s) && !/^(localhost|127\.|192\.168\.|10\.)/.test(s.replace(/^https?:\/\//i, '')) && !/:\d+$/.test(s));
    const host = s.replace(/^https?:\/\//i, '');
    return sicuro ? 'https://' + host + '/mcp' : 'http://' + host.replace(/:\d+$/, '') + ':7352/mcp';   // in locale il servizio ha la sua porta
  }
  const leggi = () => { try { const v = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); return v && v.scade > Date.now() && O() && v.stanza === O().codice ? v : null; } catch (e) { return null; } };
  const salva = v => { try { if (v) localStorage.setItem(CHIAVE, JSON.stringify(v)); else localStorage.removeItem(CHIAVE); } catch (e) { } };
  const O = () => B.Online;
  const toast = t => G.emetti('toast', t);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  function copia(t, fatto) {
    const vecchio = () => { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); return ok; };
    const ok = () => toast(fatto), ko = () => toast('Non riesco a copiare: scrivilo a mano');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => (vecchio() ? ok() : ko()));
    else (vecchio() ? ok() : ko());
  }
  function riga(etichetta, valore, msgCopia) {
    const d = el('div'); d.style.cssText = 'display:flex;gap:8px;align-items:center';
    const v = el('code', null, valore); v.style.cssText = 'flex:1;min-width:0;overflow-wrap:anywhere;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.25);font:600 13px ui-monospace,monospace;color:var(--crema)';
    const b = el('button', 'btn-secondario', 'Copia'); b.type = 'button'; b.style.cssText = 'padding:8px 12px;flex:none';
    b.addEventListener('click', () => copia(valore, msgCopia));
    d.append(v, b);
    const w = el('div'); w.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    w.append(el('p', null, etichetta), d);
    return w;
  }

  let occupato = false;
  async function crea() {
    if (occupato) return; occupato = true;
    try {
      const nick = O().mioNick();
      if (!nick) { toast('Prima scegli un nickname'); return; }
      const r = await O().rpc('claude_codice', { stanza: O().codice, nick });
      salva({ codice: r.codice, scade: r.scade, stanza: O().codice });
      toast('Codice pronto: dallo al tuo Claude');
    } catch (e) { toast('Non riesco a creare il codice: ' + ((e && e.message) || 'server non raggiungibile')); }
    finally { occupato = false; disegna(); }
  }
  async function scollega() {
    if (occupato) return; occupato = true;
    try { await O().rpc('claude_revoca', {}); salva(null); toast('Claude scollegato: il codice non vale più'); }
    catch (e) { toast('Non riesco a scollegare Claude: riprova'); }
    finally { occupato = false; disegna(); }
  }

  function disegna() {
    box.textContent = '';
    box.append(el('p', null, 'Fai entrare nel borgo il tuo Claude: compare accanto a te con 🤖, ti segue, legge la chat e parla con te e con i tuoi amici. Usa il tuo account Claude (anche dal telefono, nell\'app di Claude): non costa niente in più.'));
    const o = O();
    if (!o || !o.server || !o.rpc) {
      box.append(el('p', null, 'Funziona quando giochi online con una stanza amici sul server del borgo (link con ?amici=…).'));
      return;
    }
    if (!o.inLinea() || !(o.stato() && o.stato().aperto)) {
      box.append(el('p', null, 'Mi sto collegando al server… riapri questa pagina tra un attimo.'));
      return;
    }
    const v = leggi(), url = indirizzoMcp(o.server);
    if (!v) {
      const b = el('button', 'btn-primario', 'Collega il mio Claude'); b.type = 'button';
      b.addEventListener('click', crea);
      box.append(b);
      return;
    }
    const ore = Math.max(1, Math.round((v.scade - Date.now()) / 3600000));
    box.append(
      riga('1. Solo la prima volta: in Claude apri Impostazioni → Connettori → Aggiungi connettore personalizzato, chiamalo "The Borg" e incolla questo indirizzo:', url, 'Indirizzo copiato'),
      riga('2. Scrivi a Claude (vale ancora circa ' + ore + (ore === 1 ? ' ora' : ' ore') + '):', 'Entra in The Borg con il codice ' + v.codice, 'Frase copiata: incollala in Claude'),
      el('p', null, 'Chi ha il codice comanda il tuo Claude nel borgo: non darlo a nessuno. Claude risponde quando gli scrivi nell\'app, oppure se gli chiedi di restare in ascolto della chat.')
    );
    const fila = el('div'); fila.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    const nuovo = el('button', 'btn-secondario', 'Nuovo codice'); nuovo.type = 'button'; nuovo.addEventListener('click', crea);
    const via = el('button', 'btn-secondario', 'Scollega Claude'); via.type = 'button'; via.style.color = '#ffb3a8'; via.addEventListener('click', scollega);
    fila.append(nuovo, via); box.append(fila);
  }

  // si ridisegna quando si apre il profilo (lo stato del server puo' essere cambiato)
  const pagina = document.getElementById('pagina-profilo');
  if (pagina && window.MutationObserver) new MutationObserver(() => { if (!pagina.hidden) disegna(); }).observe(pagina, { attributes: true, attributeFilter: ['hidden'] });
  disegna();
  B.ClaudeBorgo = { indirizzoMcp, disegna };
})();
