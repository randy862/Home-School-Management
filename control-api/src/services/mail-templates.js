function renderSetupActivationEmail(input = {}) {
  const tenantName = String(input.tenantName || "your hosted workspace").trim();
  const tenantUrl = String(input.tenantUrl || "").trim();
  const setupLink = String(input.setupLink || tenantUrl).trim();
  const expirationLabel = formatDateTime(input.setupTokenExpiresAt);
  const supportEmail = String(input.supportEmail || "").trim();
  const environmentLabel = String(input.environmentLabel || "Hosted").trim();
  const subject = `${tenantName} setup link for ${environmentLabel}`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#18212f;line-height:1.6;">
      <p>Hello${input.recipientName ? ` ${escapeHtml(input.recipientName)}` : ""},</p>
      <p>Your ${escapeHtml(environmentLabel)} Navigrader workspace is ready for first-time admin setup.</p>
      <p><strong>Workspace:</strong> <a href="${escapeHtmlAttr(tenantUrl)}">${escapeHtml(tenantUrl)}</a></p>
      <p><strong>Next step:</strong> use the secure setup link below to initialize the first administrator account.</p>
      <p><a href="${escapeHtmlAttr(setupLink)}" style="display:inline-block;padding:12px 18px;background:#0f5cc0;color:#ffffff;text-decoration:none;border-radius:6px;">Open Setup Link</a></p>
      <p>If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtmlAttr(setupLink)}">${escapeHtml(setupLink)}</a></p>
      ${expirationLabel ? `<p>This link is tied to a one-time setup token that expires on <strong>${escapeHtml(expirationLabel)}</strong>.</p>` : ""}
      <p>If you did not expect this message or need help, reply to this email${supportEmail ? ` or contact <a href="mailto:${escapeHtmlAttr(supportEmail)}">${escapeHtml(supportEmail)}</a>` : ""}.</p>
      <p>Thanks,<br>Navigrader Support</p>
    </div>
  `.trim();

  const text = [
    `Hello${input.recipientName ? ` ${input.recipientName}` : ""},`,
    "",
    `Your ${environmentLabel} Navigrader workspace is ready for first-time admin setup.`,
    tenantUrl ? `Workspace: ${tenantUrl}` : "",
    "",
    "Use the secure setup link below to initialize the first administrator account:",
    setupLink,
    expirationLabel ? "" : "",
    expirationLabel ? `This one-time setup link expires on ${expirationLabel}.` : "",
    "",
    supportEmail ? `Need help? Reply to this email or contact ${supportEmail}.` : "Need help? Reply to this email.",
    "",
    "Thanks,",
    "Navigrader Support"
  ].filter((line, index, array) => line || (array[index - 1] && array[index - 1] !== "")).join("\n");

  return {
    subject,
    html,
    text
  };
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value);
}

module.exports = {
  renderSetupActivationEmail
};
