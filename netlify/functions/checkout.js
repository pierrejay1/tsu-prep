exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin' : 'https://tsu-prep.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type'                : 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { email, nivel, plano } = JSON.parse(event.body);

    // ── Pick price ID based on plan ──────────────────────────────────────────
    const priceId = plano === 'Smart Premium'
      ? 'price_1Ta1Z4KuJ73zXvcOr7TqPFQG'
      : 'price_1TZZ5CKuJ73zXvcO108ik5QT';

    // ── Build x-www-form-urlencoded body ─────────────────────────────────────
    const params = new URLSearchParams({
      'payment_method_types[]'     : 'card',
      'mode'                       : 'payment',
      'customer_email'             : email,
      'line_items[0][price]'       : priceId,
      'line_items[0][quantity]'    : '1',
      'metadata[email_form]'       : email,
      'metadata[nivel]'            : nivel || '',
      'success_url'                : 'https://tsu-prep.com/sucesso.html',
      'cancel_url'                 : 'https://tsu-prep.com',
    });

    // ── Call Stripe API ───────────────────────────────────────────────────────
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method : 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type' : 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!stripeRes.ok) {
      const err = await stripeRes.text();
      console.error('Stripe error:', err);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Stripe error', detail: err }),
      };
    }

    const session = await stripeRes.json();
    console.log('Checkout session created:', session.id, '|', email, '|', plano);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
