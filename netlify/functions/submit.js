exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': 'https://tsu-prep.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const data = JSON.parse(event.body);

    // Map HTML form fields to Tally field names
    const tallyPayload = {
      formId: '44pByY',
      fields: [
        { label: 'Nome completo',              value: data.name      || '' },
        { label: 'Idade',                      value: data.age       || '' },
        { label: 'Gênero',                     value: data.gender    || '' },
        { label: 'Email de Contato',           value: data.email     || '' },
        { label: 'Telefone/Whatsapp',          value: data.phone     || '' },
        { label: 'Anos falando inglês',        value: data.years     || '' },
        { label: 'Nível atual estimado',       value: data.level     || '' },
        { label: 'Score mínimo desejado',      value: data.score     || '' },
        { label: 'Finalidade do teste',        value: data.purpose   || '' },
        { label: 'Prazo até o Teste',          value: data.deadline  || '' },
        { label: 'Horas disponíveis por dia',  value: data.hours     || '' },
        { label: 'Pontos fortes em inglês',    value: data.strengths || '' },
        { label: 'Pontos fracos em inglês',    value: data.weaknesses|| '' },
        { label: 'Um hobby seu',               value: data.hobby     || '' },
        { label: 'Algo que você nao gosta de fazer', value: data.dislike || '' },
        { label: 'Como nos conheceu?',         value: data.source    || '' },
        { label: 'Plano',                      value: data.plan      || '' },
      ]
    };

    const tallyRes = await fetch('https://api.tally.so/forms/44pByY/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tallyPayload)
    });

    if (!tallyRes.ok) {
      const errText = await tallyRes.text();
      console.error('Tally error:', tallyRes.status, errText);
      // Still return success to user — don't block payment flow
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error('Function error:', err);
    // Still return success — don't block payment flow on Tally errors
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }
};
