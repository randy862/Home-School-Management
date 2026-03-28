const assets = [
  "NOTES/control-plane-foundation.md",
  "infra/systemd/home-school-management.service",
  "infra/apache/home-school-management.conf",
  "RUNBOOKS/hosted-deployment.md"
];

const list = document.getElementById("asset-list");
if (list) {
  list.innerHTML = assets.map((asset) => `<li>${asset}</li>`).join("");
}
