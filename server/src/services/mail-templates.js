function renderPasswordResetEmail(input = {}) {
  const appName = String(input.appName || "Navigrader").trim();
  const resetUrl = String(input.resetUrl || "").trim();
  const supportEmail = String(input.supportEmail || "").trim();
  const expirationMinutes = Math.max(1, Number(input.expirationMinutes || 60));
  const recipientName = String(input.recipientName || "").trim();
  const subject = `${appName} password reset`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#18212f;line-height:1.6;">
      <p>Hello${recipientName ? ` ${escapeHtml(recipientName)}` : ""},</p>
      <p>We received a request to reset the password for your ${escapeHtml(appName)} account.</p>
      <p><a href="${escapeHtmlAttr(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#1f4fe0;color:#ffffff;text-decoration:none;border-radius:8px;">Reset Password</a></p>
      <p>If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtmlAttr(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
      <p>This one-time link expires in <strong>${expirationMinutes} minute${expirationMinutes === 1 ? "" : "s"}</strong>.</p>
      <p>If you did not request this reset, you can ignore this email. Your password will stay the same.</p>
      <p>Need help? ${supportEmail ? `Contact <a href="mailto:${escapeHtmlAttr(supportEmail)}">${escapeHtml(supportEmail)}</a>.` : "Reply to this email."}</p>
      <p>Thanks,<br>Navigrader Support</p>
    </div>
  `.trim();

  const text = [
    `Hello${recipientName ? ` ${recipientName}` : ""},`,
    "",
    `We received a request to reset the password for your ${appName} account.`,
    "",
    "Use this one-time link to reset your password:",
    resetUrl,
    "",
    `This link expires in ${expirationMinutes} minute${expirationMinutes === 1 ? "" : "s"}.`,
    "If you did not request this reset, you can ignore this email. Your password will stay the same.",
    "",
    supportEmail ? `Need help? Contact ${supportEmail}.` : "Need help? Reply to this email.",
    "",
    "Thanks,",
    "Navigrader Support"
  ].join("\n");

  return {
    subject,
    html,
    text
  };
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
  renderPasswordResetEmail
};
