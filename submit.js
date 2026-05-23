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
      'Hobby', 'Não gosta de fazer', 'Como nos conheceu?'
    ];

    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET + '!A1:R1')}`,
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
