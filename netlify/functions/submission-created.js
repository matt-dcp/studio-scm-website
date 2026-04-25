// Fires on every Netlify form submission.
// Sends an email to Amy via Resend with the submission details.
// Requires env var RESEND_API_KEY set in Netlify site settings.

const TO = "amy@studioscm.com";
// Must not be a real Google Workspace mailbox — Google rejects same-domain
// mail arriving via external relays (Resend/SES) as spoofing, even with
// valid SPF/DKIM. `postcards@` is not provisioned in Workspace.
const FROM = "Studio SCM Postcards <postcards@studioscm.com>";

export default async (req) => {
  const body = await req.json();
  const submission = body?.payload;
  if (!submission || submission.form_name !== "inquiry") {
    return new Response("ignored", { status: 200 });
  }

  const d = submission.data || {};
  const name = d.name || "(no name)";
  const email = d.email || "(no email)";
  const travelers = d.travelers || "—";
  const month = d.month || "—";
  const budget = d.budget || "—";
  const dream = d.dream || "—";
  const submittedAt = submission.created_at || new Date().toISOString();

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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: email,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Resend error:", res.status, errorText);
    return new Response(`resend failed: ${res.status}`, { status: 500 });
  }

  return new Response("sent", { status: 200 });
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
