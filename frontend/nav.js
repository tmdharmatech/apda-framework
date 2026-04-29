/**
 * nav.js — Navegação global da WebUI APDA.
 * Injeta a barra de navegação no header existente e marca a página ativa.
 *
 * Uso: adicionar <script src="/nav.js"></script> antes do </body>.
 * Requer que a página tenha um <div class="topbar"> dentro de <header>.
 */

(function () {
  const PAGES = [
    { label: "Executar",    href: "/run.html" },
    { label: "Diagnóstico", href: "/doctor.html" },
    { label: "Servidor",    href: "/server.html" },
    { label: "Artefatos",   href: "/index.html" },
    { label: "Benchmarks",  href: "/benchmarks.html" },
    { label: "Histórico",   href: "/history.html" },
  ];

  function currentPage() {
    const p = window.location.pathname;
    if (p === "/" || p === "") return "/index.html";
    return p;
  }

  function buildNav() {
    const nav = document.createElement("nav");
    nav.className = "nav";
    const current = currentPage();

    for (const page of PAGES) {
      const a = document.createElement("a");
      a.href = page.href;
      a.textContent = page.label;
      if (page.href === current) a.classList.add("active");
      nav.appendChild(a);
    }
    return nav;
  }

  function inject() {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;

    const existing = topbar.querySelector("nav.nav, .nav, .actions");
    if (existing) {
      existing.replaceWith(buildNav());
    } else {
      topbar.appendChild(buildNav());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
