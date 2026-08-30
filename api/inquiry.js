// Vercel serverless function: receives inquiry form submissions and emails
// Amy via Resend. Port of netlify/functions/submission-created.js for the
// Netlify → Vercel migration (2026-08). Same email format and rules.
// Env vars (Vercel project settings):
//   RESEND_API_KEY  — required
//   TO_EMAIL        — optional override (defaults to Amy); set to a test
//                     address in Preview env to test without emailing Amy.

const DEFAULT_TO = "amy@studioscm.com";
// Must not be a real Google Workspace mailbox — Google rejects same-domain
// mail arriving via external relays (Resend/SES) as spoofing, even with
// valid SPF/DKIM. `postcards@` is not provisioned in Workspace.
const FROM = "Studio SCM Postcards <postcards@studioscm.com>";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("method not allowed");
    return;
  }

  const d = req.body || {};
  const name = d.name || "(no name)";
  const email = d.email || "(no email)";
  const travelers = d.travelers || "—";
  const month = d.month || "—";
  const budget = d.budget || "—";
  const dream = d.dream || "—";
  const submittedAt = new Date().toISOString();

  const subject = `New inquiry from ${name}`;
  const text = [
    `New postcard from the Studio SCM site.`,
    ``,
    `From:       ${name} <${email}>`,
    `Travelers:  ${travelers}`,
    `Month:      ${month}`,
    `Budget:     ${budget}`,
    `Submitted:  ${submittedAt}`,
    ``,
    `Dream trip:`,
    dream,
  ].join("\n");

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;line-height:1.5;color:#222">
      <h2 style="margin-top:0">New postcard from the Studio SCM site</h2>
      <p><strong>${escapeHtml(name)}</strong> &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#777">Travelers</td><td>${escapeHtml(travelers)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#777">Month</td><td>${escapeHtml(month)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#777">Budget</td><td>${escapeHtml(budget)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#777">Submitted</td><td>${escapeHtml(submittedAt)}</td></tr>
      </table>
      <p style="color:#777;margin-bottom:4px">Dream trip:</p>
      <blockquote style="border-left:3px solid #ddd;margin:0;padding:8px 16px;color:#333;white-space:pre-wrap">${escapeHtml(dream)}</blockquote>
    </div>
  `;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [process.env.TO_EMAIL || DEFAULT_TO],
      reply_to: email,
      subject,
      text,
      html,
    }),
  });

  if (!r.ok) {
    const errorText = await r.text();
    console.error("Resend error:", r.status, errorText);
    res.status(500).send("send failed");
    return;
  }

  res.status(200).send("sent");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
