// HTTP-triggered function for the classic homepage inquiry form.
// Receives JSON POST from /classic, emails Amy via Resend.
// Requires env var RESEND_API_KEY.

const TO = "amy@studioscm.com";
const FROM = "Studio SCM Inquiries <postcards@studioscm.com>";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const firstName = (data.first_name || "").trim();
  const lastName = (data.last_name || "").trim();
  const email = (data.email || "").trim();
  const message = (data.message || "").trim();

  if (!firstName || !lastName || !email || !message) {
    return new Response("missing fields", { status: 400 });
  }

  const fullName = `${firstName} ${lastName}`;
  const subject = `New inquiry from ${fullName}`;

  const text = [
    `New inquiry from the Studio SCM site.`,
    ``,
    `From:    ${fullName} <${email}>`,
    ``,
    `Message:`,
    message,
  ].join("\n");

  const html = `
    <div style="font-family:Georgia,serif;max-width:560px;line-height:1.55;color:#1E1A14">
      <h2 style="margin-top:0;font-weight:500">New inquiry from the Studio SCM site</h2>
      <p><strong>${escapeHtml(fullName)}</strong> &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;</p>
      <p style="color:#6B5E4A;margin-bottom:6px">Message:</p>
      <blockquote style="border-left:3px solid #ddd;margin:0;padding:8px 16px;color:#1E1A14;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
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

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
