const head = document.querySelector("[data-head]");
const toggle = document.querySelector(".nav-toggle");
const mobileNav = document.getElementById("mobile-nav");
const form = document.querySelector("[data-form]");
const status = document.querySelector("[data-form-status]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function onScroll() {
  if (!head) return;
  head.classList.toggle("is-scrolled", window.scrollY > 30);
}
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

if (toggle && mobileNav) {
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    mobileNav.hidden = open;
  });
  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "false");
      mobileNav.hidden = true;
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
      ? `Thank you, ${name}. The front desk will confirm by email.`
      : "Thank you. The front desk will confirm by email.";
    form.reset();
  });
}
