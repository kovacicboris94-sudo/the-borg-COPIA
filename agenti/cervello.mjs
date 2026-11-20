// Il collegamento con Claude Haiku 5.5 (SDK ufficiale di Anthropic) e un
// "cervello finto" per provare tutto senza chiave e senza spendere niente.
import Anthropic from '@anthropic-ai/sdk';
import { MODELLO } from './motore.mjs';

// Restituisce la funzione che il motore chiama per far pensare un agente.
export function cervelloClaude(apiKey) {
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60 * 1000 });
  let schemaAccettato = true;   // se l'API rifiuta lo schema, si chiede il JSON solo nel prompt
  return async function pensa({ system, messaggio, sforzo, maxTokens, schema }) {
    const richiesta = (conSchema) => ({
      model: MODELLO,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: messaggio }],
      output_config: conSchema ? { effort: sforzo, format: { type: 'json_schema', schema } } : { effort: sforzo }
    });
    let r;
    try {
      r = await client.messages.create(richiesta(schemaAccettato));
    } catch (e) {
      // una richiesta rifiutata (400) non costa nulla: si riprova una volta senza schema
      if (schemaAccettato && e instanceof Anthropic.BadRequestError) { schemaAccettato = false; r = await client.messages.create(richiesta(false)); }
      else throw e;
    }
    const testo = r.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return { testo, usage: r.usage, stop_reason: r.stop_reason };
  };
}

// Cervello finto: decide a caso ma in modo sensato e "costa" come un pensiero vero,
// cosi' si prova anche il tetto del budget. Si accende con AGENTI_FINTI=1.
export function cervelloFinto(seme = 1) {
  let s = seme;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const luoghi = ['Fontana', 'Belvedere', 'Mercatino', 'Laghetto', 'Torre della Cometa', 'Ingresso del borgo'];
  return async function pensa({ messaggio }) {
    const m = /DOVE SEI: x=(-?\d+) z=(-?\d+)/.exec(messaggio), x = m ? +m[1] : 0, z = m ? +m[2] : 40;
    const az = [], k = rnd();
    if (k < 0.35) az.push({ tipo: 'vai', luogo: luoghi[Math.floor(rnd() * luoghi.length)] });
    else if (k < 0.65) az.push({ tipo: 'costruisci', nome: 'blocco di prova', forma: ['cubo', 'cilindro', 'piramide'][Math.floor(rnd() * 3)], larghezza: 1, altezza: 1, profondita: 1, colore: '#a0703f', x: x + 3, z: z + 2 });
    else az.push({ tipo: 'di', testo: ['Che bella giornata nel borgo!', 'Chi ha costruito questo?', 'Mi piace questo posto.'][Math.floor(rnd() * 3)] });
    const lunga = /scrivi "memoria_nuova"/.test(messaggio);
    return {
      testo: JSON.stringify({ pensiero: 'Prova: faccio ' + az[0].tipo, azioni: az, ricorda: 'Ho fatto ' + az[0].tipo, prossimo_pensiero_minuti: 2 + Math.floor(rnd() * 5), sforzo_prossimo: 'basso', memoria_nuova: lunga ? 'Memoria riassunta di prova: vivo nel borgo e faccio cose a caso per provare il motore.' : '' }),
      usage: { input_tokens: Math.ceil(messaggio.length / 3) + 1400, output_tokens: 300 },
      stop_reason: 'end_turn'
    };
  };
}
