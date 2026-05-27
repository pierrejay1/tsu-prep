// ── Matching algorithm ────────────────────────────────────────────────────────
// Barème défini dans CLAUDE_matching.md
function computeScore(data) {
  let total = 0;

  // Nível atual estimado
  const level = (data.level || '').toUpperCase().trim();
  if      (level.startsWith('C1')) total += 35;
  else if (level.startsWith('B2')) total += 28;
  else if (level.startsWith('B1')) total += 20;
  else if (level.startsWith('A2')) total += 12;
  else if (level.startsWith('A1')) total += 5;

  // Score mínimo desejado
  const score = parseInt(data.score, 10);
  if (!isNaN(score)) {
    if      (score >= 111) total += 25;
    else if (score >= 101) total += 20;
    else if (score >= 91)  total += 15;
    else if (score >= 81)  total += 8;
    else if (score >= 71)  total += 3;
    // 60-70 = 0pts
  }

  // Horas disponíveis por dia
  const hours = parseFloat((data.hours || '').toString().replace(',', '.'));
  if (!isNaN(hours)) {
    if      (hours <= 0.5) total += 20;
    else if (hours <= 1)   total += 16;
    else if (hours <= 2)   total += 11;
    else if (hours <= 3)   total += 6;
    else                   total += 2;  // 4h+
  }

  // Prazo até o Teste
  const prazo = (data.deadline || '').toLowerCase();
  if      (/\<\s*1|menos.*1\s*sem|menos.*uma\s*sem/.test(prazo)) total += 12;
  else if (/1[\s-]?a?[\s-]?2\s*sem|1-2/.test(prazo))             total += 9;
  else if (/2[\s-]?a?[\s-]?4\s*sem|2-4/.test(prazo))             total += 6;
  else if (/1[\s-]?a?[\s-]?3\s*m|1-3\s*m/.test(prazo))          total += 3;
  // 3+ mois = 0pts

  // Anos falando inglês
  const anosStr = (data.years || '').toString().toLowerCase().trim();
  const anosNum = parseFloat(anosStr);
  if      (/10\s*\+|10\s*ou\s*mais|10\s*ans\s*\+/.test(anosStr) || anosNum >= 10)                       total += 8;
  else if (/7[\s-]?a?[\s-]?10/.test(anosStr) || (anosNum >= 7 && anosNum < 10))                         total += 7;
  else if (/4[\s-]?a?[\s-]?6/.test(anosStr)  || (anosNum >= 4 && anosNum <= 6))                         total += 5;
  else if (/2[\s-]?a?[\s-]?3/.test(anosStr)  || (anosNum >= 2 && anosNum <= 3))                         total += 3;
  else if (/0[\s-]?a?[\s-]?1/.test(anosStr)  || (anosNum >= 0 && anosNum <= 1))                         total += 1;

  // Catégories par tranches de points
  if      (total >= 74) return 'Avancé';
  else if (total >= 58) return 'Intermédiaire Avancé';
  else if (total >= 39) return 'Intermédiaire';
  else if (total >= 29) return 'Débutant Avancé';
  else                  return 'Débutant';
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': 'https://tsu-prep.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Always return success to client — never block the payment flow
  const ok = { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  try {
    const data = JSON.parse(event.body);

    // ── 1. Build JWT ──────────────────────────────────────────────────────────
    const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey       = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const sheetId      = process.env.GOOGLE_SHEET_ID;

    const now     = Math.floor(Date.now() / 1000);
    const payload = {
      iss  : serviceEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud  : 'https://oauth2.googleapis.com/token',
      iat  : now,
      exp  : now + 3600,
    };

    // Helper: base64url encode
    const b64url = str =>
      Buffer.from(str).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body    = b64url(JSON.stringify(payload));
    const signing = `${header}.${body}`;

    // Sign with RS256 using Node's built-in crypto
    const { createSign } = require('crypto');
    const sign = createSign('RSA-SHA256');
    sign.update(signing);
    const signature = sign.sign(rawKey, 'base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwt = `${signing}.${signature}`;

    // ── 2. Exchange JWT for access token ──────────────────────────────────────
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method : 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body   : `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });

    if (!tokenRes.ok) {
      console.error('Token error:', await tokenRes.text());
      return ok;
    }

    const { access_token } = await tokenRes.json();

    // ── 3. Check if sheet is empty → write headers first ─────────────────────
    const SHEET = 'Feuille 1';
    const COLUMNS = [
      'Timestamp', 'Plano', 'Nome completo', 'Idade', 'Gênero',
      'Email', 'Telefone/Whatsapp', 'Anos falando inglês',
      'Nível atual estimado', 'Score mínimo desejado',
      'Finalidade do teste', 'Prazo até o Teste',
      'Horas disponíveis por dia', 'Pontos fortes', 'Pontos fracos',
      'Hobby', 'Não gosta de fazer', 'Como nos conheceu?',
      'Nível Recomendado'
    ];

    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET + '!A1:S1')}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const checkData = await checkRes.json();
    const isEmpty = !checkData.values || checkData.values.length === 0;

    if (isEmpty) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET + '!A1')}:append?valueInputOption=RAW`,
        {
          method : 'POST',
          headers: {
            Authorization : `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [COLUMNS] }),
        }
      );
    }

    // ── 4. Append the new submission row ──────────────────────────────────────
    const timestamp = new Date().toISOString();
    const nivel_recomendado = computeScore(data);
    const row = [
      timestamp,
      data.plan       || '',
      data.name       || '',
      data.age        || '',
      data.gender     || '',
      data.email      || '',
      data.phone      || '',
      data.years      || '',
      data.level      || '',
      data.score      || '',
      data.purpose    || '',
      data.deadline   || '',
      data.hours      || '',
      data.strengths  || '',
      data.weaknesses || '',
      data.hobby      || '',
      data.dislike    || '',
      data.source     || '',
      nivel_recomendado,
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET + '!A1')}:append?valueInputOption=RAW`,
      {
        method : 'POST',
        headers: {
          Authorization : `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      }
    );

    if (!appendRes.ok) {
      console.error('Sheets append error:', await appendRes.text());
    } else {
      console.log('Row appended successfully:', data.email, data.plan);
    }

    return ok;

  } catch (err) {
    console.error('Function error:', err);
    return ok;
  }
};
