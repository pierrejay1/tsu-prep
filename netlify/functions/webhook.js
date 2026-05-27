const { createHmac, timingSafeEqual } = require('crypto');

// ── Nivel → prep page URL ─────────────────────────────────────────────────────
const PREP_URLS = {
  'Débutant'             : 'https://tsu-prep.com/preps/debutant.html',
  'Débutant Avancé'      : 'https://tsu-prep.com/preps/debutant-avance.html',
  'Intermédiaire'        : 'https://tsu-prep.com/preps/intermediaire.html',
  'Intermédiaire Avancé' : 'https://tsu-prep.com/preps/intermediaire-avance.html',
  'Avancé'               : 'https://tsu-prep.com/preps/avance.html',
};

// ── Stripe signature verification (HMAC-SHA256, no SDK) ───────────────────────
function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSec = 300) {
  if (!sigHeader || !secret) return false;

  // Parse "t=...,v1=...,v1=..." header
  let timestamp = null;
  const v1Sigs  = [];

  for (const part of sigHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === 't')  timestamp = val;
    if (key === 'v1') v1Sigs.push(val);
  }

  if (!timestamp || v1Sigs.length === 0) return false;

  // Tolerance check
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (Math.abs(age) > toleranceSec) {
    console.error('Stripe signature expired — age:', age, 's');
    return false;
  }

  // Compute expected HMAC
  const signed   = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  const expBuf   = Buffer.from(expected, 'hex');

  return v1Sigs.some(s => {
    try {
      const sBuf = Buffer.from(s, 'hex');
      return sBuf.length === expBuf.length && timingSafeEqual(sBuf, expBuf);
    } catch { return false; }
  });
}

// ── Email HTML template ───────────────────────────────────────────────────────
function buildEmailHtml(prepUrl, nivel) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Seu plano TSU! está pronto</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:32px 40px;text-align:center;">
              <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">TSU<span style="color:#f59e0b;">!</span> Prep</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">
                Seu plano de preparação está pronto! 🎯
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
                Pagamento confirmado. Preparamos um plano de estudo personalizado para o seu perfil — nível <strong>${nivel || 'identificado'}</strong> — com exercícios, estratégias e um Mock Test completo.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background:#f59e0b;border-radius:8px;">
                    <a href="${prepUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#0f172a;text-decoration:none;letter-spacing:0.2px;">
                      Acessar meu plano →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
                Ou copie e cole o link abaixo no seu navegador:
              </p>
              <p style="margin:0 0 28px;font-size:13px;color:#64748b;word-break:break-all;">
                <a href="${prepUrl}" style="color:#f59e0b;">${prepUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                Dúvidas? Responda este email ou entre em contato em
                <a href="mailto:contact@tsu-prep.com" style="color:#f59e0b;text-decoration:none;">contact@tsu-prep.com</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#cbd5e1;">
                © ${new Date().getFullYear()} TSU! Prep · tsu-prep.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async function(event) {
  // Always return 200 so Stripe doesn't retry
  const ok = { statusCode: 200, body: JSON.stringify({ received: true }) };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Netlify may base64-encode the body for binary payloads — decode if needed
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  // ── 1. Verify Stripe signature ────────────────────────────────────────────
  const sigHeader = event.headers['stripe-signature'];
  const valid = verifyStripeSignature(
    rawBody,
    sigHeader,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (!valid) {
    console.error('Invalid Stripe signature — request rejected');
    return ok; // still 200 to avoid Stripe retries flooding logs
  }

  // ── 2. Parse event ────────────────────────────────────────────────────────
  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (err) {
    console.error('Failed to parse Stripe event body:', err);
    return ok;
  }

  console.log('Stripe event received:', stripeEvent.type, '|', stripeEvent.id);

  // ── 3. Handle checkout.session.completed ──────────────────────────────────
  if (stripeEvent.type === 'checkout.session.completed') {
    const session   = stripeEvent.data.object;
    const emailForm = session.metadata?.email_form;
    const nivel     = session.metadata?.nivel;

    if (!emailForm) {
      console.error('checkout.session.completed — no email_form in metadata', session.id);
      return ok;
    }

    const prepUrl = PREP_URLS[nivel] || PREP_URLS['Intermédiaire'];
    console.log('Sending prep email to:', emailForm, '| Nivel:', nivel, '| URL:', prepUrl);

    // ── 4. Send email via Resend ────────────────────────────────────────────
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method : 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify({
          from   : 'TSU! Prep <assistant@tsu-prep.com>',
          to     : [emailForm],
          subject: 'Seu plano de preparação TOEFL está pronto! 🎯',
          html   : buildEmailHtml(prepUrl, nivel),
        }),
      });

      if (!emailRes.ok) {
        console.error('Resend error:', await emailRes.text());
      } else {
        const resData = await emailRes.json();
        console.log('Email sent — Resend ID:', resData.id);
      }
    } catch (err) {
      console.error('Email send error:', err);
    }
  }

  return ok;
};
