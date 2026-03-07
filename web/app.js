const statusText = document.getElementById("status-text");
const statusBtn = document.getElementById("status-btn");

statusBtn.addEventListener("click", () => {
  const now = new Date().toLocaleString();
  statusText.textContent = `Smoke interaction passed at ${now}.`;
});
