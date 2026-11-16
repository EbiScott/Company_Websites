const menu = document.querySelector(".menu");
const panel = document.getElementById("menu-panel");
const ticker = document.getElementById("ticker");
const form = document.querySelector("[data-form]");
const status = document.querySelector("[data-form-status]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (menu && panel) {
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!open));
    panel.hidden = open;
  });
  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.setAttribute("aria-expanded", "false");
      panel.hidden = true;
    });
  });
}

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

if (ticker && !reduce) {
  const base = [
    ["DANGCEM", 1.82],
    ["MTNN", -0.64],
    ["GTCO", 0.41],
    ["ZENITH", 1.06],
    ["BUACEMENT", -1.10],
    ["SEPLAT", 2.34],
  ];
  const render = () => {
    ticker.innerHTML = "";
    for (const [sym, baseChg] of base) {
      const chg = baseChg + (Math.random() - 0.5) * 0.12;
      const item = document.createElement("span");
      const label = document.createElement("b");
      label.className = chg >= 0 ? "up" : "down";
      label.textContent = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
      item.textContent = `${sym}  `;
      item.append(label);
      ticker.append(item);
    }
  };
  render();
  setInterval(render, 4200);
}

const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !reduce) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-in"));
}

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    status.textContent = name
      ? `Thanks, ${name}. We will send an invite when a seat opens.`
      : "Thanks. We will send an invite when a seat opens.";
    form.reset();
  });
}
