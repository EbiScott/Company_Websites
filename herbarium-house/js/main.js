const head = document.querySelector("[data-head]");
const menu = document.querySelector(".menu");
const panel = document.getElementById("menu-panel");
const form = document.querySelector("[data-form]");
const status = document.querySelector("[data-form-status]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function onScroll() {
  head?.classList.toggle("is-scrolled", window.scrollY > 24);
}
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

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

if (!reduce && "IntersectionObserver" in window) {
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
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
} else {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
}

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    status.textContent = name
      ? `Thank you, ${name}. We will reply from the house.`
      : "Thank you. We will reply from the house.";
    form.reset();
  });
}
