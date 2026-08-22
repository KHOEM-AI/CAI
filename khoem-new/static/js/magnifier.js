const KhoemMagnifier = {
  active: false,
  init() {
    const btn = document.createElement("button");
    btn.className = "magnifier-toggle";
    btn.textContent = "🔍";
    btn.title = "ពង្រីកអក្សរ";
    btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(btn);
  },
  toggle() {
    this.active = !this.active;
    document.body.classList.toggle("magnifier-active", this.active);
  }
};
document.addEventListener("DOMContentLoaded", () => KhoemMagnifier.init());
