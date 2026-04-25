// HTTP-triggered function for the client intake form.
// Receives JSON POST from /clientintake, emails Amy via Resend.
// Requires env var RESEND_API_KEY.

const TO = "amy@studioscm.com";
const FROM = "Studio SCM Intake <postcards@studioscm.com>";

// Field groupings — keys must match `name` attributes in clientintake.html.
// Anything submitted that's not listed here is appended under "Other fields".
const SECTIONS = [
  ["Identity & Contact", [
    "first_name", "last_name", "preferred_name", "dob",
    "phone_primary", "phone_secondary", "email",
    "address_business", "address_city", "address_state_zip", "address_personal",
  ]],
  ["Passport & Travel Documents", [
    "passport_number", "passport_expiry", "passport_country",
    "nationality", "ktn", "global_entry",
  ]],
  ["Payment", [
    "cardholder_name",
  ]],
  ["Travel History", [
    "countries_visited",
    "hotel_1", "hotel_2", "hotel_3", "hotel_4",
    "hotel_5", "hotel_6", "hotel_7", "hotel_8",
  ]],
  ["Travel Preferences", [
    "destination_notes",
    "flight_class", "airline_pref", "hotel_type", "room_pref",
    "dietary", "mobility", "contact_pref",
  ]],
  ["Notes", [
    "additional_notes",
  ]],
  ["Onboarding Checklist", [
    "onboarding_checklist",
  ]],
];

const FIELD_LABELS = {
  first_name: "First name",
  last_name: "Last name",
  preferred_name: "Preferred name",
  dob: "Date of birth",
  phone_primary: "Primary phone",
  phone_secondary: "Secondary phone",
  email: "Email",
  address_business: "Business address",
  address_city: "City",
  address_state_zip: "State / ZIP",
  address_personal: "Personal address",
  passport_number: "Passport #",
  passport_expiry: "Passport expiry",
  passport_country: "Country of issue",
  nationality: "Nationality",
  ktn: "KTN (TSA Pre)",
  global_entry: "Global Entry / NEXUS",
  cardholder_name: "Cardholder name",
  countries_visited: "Countries visited",
  hotel_1: "Hotel 1", hotel_2: "Hotel 2", hotel_3: "Hotel 3", hotel_4: "Hotel 4",
  hotel_5: "Hotel 5", hotel_6: "Hotel 6", hotel_7: "Hotel 7", hotel_8: "Hotel 8",
  destination_notes: "Destination notes",
  flight_class: "Flight class",
  airline_pref: "Preferred airlines",
  hotel_type: "Preferred hotel types",
  room_pref: "Room preferences",
  dietary: "Dietary",
  mobility: "Mobility / accessibility",
  contact_pref: "Contact preference",
  additional_notes: "Additional notes",
  onboarding_checklist: "Onboarding checklist",
};

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

  if (!data || typeof data !== "object") {
    return new Response("invalid payload", { status: 400 });
  }

  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || "(no name)";
  const email = data.email || "(no email)";

  const claimed = new Set();
  const sectionsRendered = SECTIONS.map(([title, fields]) => {
    const rows = fields
      .filter((f) => data[f] !== undefined && String(data[f]).trim() !== "")
      .map((f) => {
        claimed.add(f);
        return { label: FIELD_LABELS[f] || f, value: String(data[f]) };
      });
    return { title, rows };
  }).filter((s) => s.rows.length > 0);

  // Loyalty programs — dynamic ff_airline_N / ff_hotel_N pairs.
  const loyaltyRows = [];
  for (const kind of [
    { prefix: "airline", label: "Airline" },
    { prefix: "hotel", label: "Hotel" },
  ]) {
    const indexes = Object.keys(data)
      .map((k) => k.match(new RegExp(`^ff_${kind.prefix}_(\\d+)$`)))
      .filter(Boolean)
      .map((m) => parseInt(m[1], 10))
      .sort((a, b) => a - b);
    for (const i of indexes) {
      const name = (data[`ff_${kind.prefix}_${i}`] || "").trim();
      const num = (data[`ff_${kind.prefix}_num_${i}`] || "").trim();
      claimed.add(`ff_${kind.prefix}_${i}`);
      claimed.add(`ff_${kind.prefix}_num_${i}`);
      if (!name && !num) continue;
      const value = num ? `${name || "(no name)"} · ${num}` : name;
      loyaltyRows.push({ label: kind.label, value });
    }
  }
  if (loyaltyRows.length) {
    const tpIdx = sectionsRendered.findIndex((s) => s.title === "Travel Preferences");
    const insertAt = tpIdx >= 0 ? tpIdx + 1 : sectionsRendered.length;
    sectionsRendered.splice(insertAt, 0, { title: "Frequent Flyer / Loyalty", rows: loyaltyRows });
  }

  // Anything else (preference pills with dynamic keys, future fields)
  const otherRows = Object.keys(data)
    .filter((k) => !claimed.has(k) && String(data[k]).trim() !== "")
    .sort()
    .map((k) => ({ label: k, value: String(data[k]) }));
  if (otherRows.length) sectionsRendered.push({ title: "Other fields", rows: otherRows });

  const subject = `New client intake: ${fullName}`;
  const text = renderText(fullName, email, sectionsRendered);
  const html = renderHtml(fullName, email, sectionsRendered);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: email !== "(no email)" ? email : undefined,
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

function renderText(fullName, email, sections) {
  const lines = [
    `New client intake from ${fullName} <${email}>`,
    `Submitted ${new Date().toISOString()}`,
    "",
  ];
  for (const s of sections) {
    lines.push(`── ${s.title} ──`);
    for (const r of s.rows) lines.push(`${r.label}: ${r.value}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderHtml(fullName, email, sections) {
  const sectionsHtml = sections.map((s) => `
    <h3 style="margin:24px 0 8px;font-family:Georgia,serif;color:#222;border-bottom:1px solid #ddd;padding-bottom:4px">${escapeHtml(s.title)}</h3>
    <table style="border-collapse:collapse;width:100%">
      ${s.rows.map((r) => `
        <tr>
          <td style="padding:4px 12px 4px 0;color:#777;vertical-align:top;white-space:nowrap">${escapeHtml(r.label)}</td>
          <td style="padding:4px 0;color:#222;white-space:pre-wrap">${escapeHtml(r.value)}</td>
        </tr>
      `).join("")}
    </table>
  `).join("");

  return `
    <div style="font-family:Georgia,serif;max-width:640px;line-height:1.5;color:#222">
      <h2 style="margin-top:0">New client intake</h2>
      <p><strong>${escapeHtml(fullName)}</strong> &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;</p>
      ${sectionsHtml}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
