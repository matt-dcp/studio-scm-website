/* Studio SCM — interactions
   Parallax on taped hero cards, reveal on pillars, multi-step inquiry form. */

(function () {
  "use strict";

  // --- Auto-update masthead issue date ("Vol. 014 · Spring 2026") ---
  const issueEl = document.getElementById("issueDate");
  if (issueEl) {
    const now = new Date();
    const m = now.getMonth();
    const season =
      m === 11 || m <= 1 ? "Winter" :
      m <= 4 ? "Spring" :
      m <= 7 ? "Summer" :
      "Fall";
    issueEl.textContent = `Vol. 014 · ${season} ${now.getFullYear()}`;
  }

  // --- Parallax on elements with [data-parallax="<strength>"] ---
  const parallaxEls = Array.from(document.querySelectorAll("[data-parallax]"));
  if (parallaxEls.length) {
    let raf = 0;
    const update = () => {
      const vh = window.innerHeight;
      for (const el of parallaxEls) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const strength = parseFloat(el.dataset.parallax) || 20;
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.setProperty("--parY", (-p * strength).toFixed(2) + "px");
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  // --- Pillar reveal on scroll (IntersectionObserver + fallback) ---
  const revealEls = Array.from(document.querySelectorAll("[data-reveal]"));
  if (revealEls.length) {
    const reveal = (el) => el.classList.add("is-in");
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              reveal(e.target);
              io.unobserve(e.target);
            }
          }
        },
        { threshold: 0.05, rootMargin: "0px 0px -5% 0px" }
      );
      revealEls.forEach((el) => {
        io.observe(el);
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) reveal(el);
      });
      // belt-and-suspenders safety net
      setTimeout(() => revealEls.forEach(reveal), 1500);
    } else {
      revealEls.forEach(reveal);
    }
  }

  // --- Inquiry form: multi-step ---
  const form = document.getElementById("inquiryForm");
  if (form) {
    const steps = Array.from(form.querySelectorAll(".inq-step"));
    const bar = document.getElementById("inquiryBar");
    const btnNext = document.getElementById("inquiryNext");
    const btnBack = document.getElementById("inquiryBack");
    const dateEl = document.getElementById("inquiryDate");
    const sentName = document.getElementById("inquirySentName");
    const sentEmail = document.getElementById("inquirySentEmail");

    // Postmark date
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });

    const state = { step: 0, data: { name: "", email: "", travelers: "", month: "", dream: "", budget: "" } };
    const TOTAL = 3; // input steps; step 3 = sent

    const render = () => {
      steps.forEach((s) => {
        const n = parseInt(s.dataset.step, 10);
        s.hidden = n !== state.step;
      });
      bar.style.width = ((state.step / TOTAL) * 100) + "%";
      btnBack.hidden = !(state.step > 0 && state.step < TOTAL);
      if (state.step >= TOTAL) {
        btnNext.hidden = true;
      } else {
        btnNext.hidden = false;
        btnNext.textContent = state.step === TOTAL - 1 ? "Send postcard →" : "Next →";
      }
    };

    // Bind name/email/dream inputs
    form.addEventListener("input", (e) => {
      const t = e.target;
      if (t.name && t.name in state.data) state.data[t.name] = t.value;
    });

    // Chip groups (travelers, budget, month) — also mirror into hidden inputs for Netlify
    form.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-value]");
      if (!chip) return;
      const group = chip.parentElement && chip.parentElement.dataset.group;
      if (!group) return;
      state.data[group] = chip.dataset.value;
      const hidden = form.querySelector(`input[type="hidden"][name="${group}"]`);
      if (hidden) hidden.value = chip.dataset.value;
      const siblings = chip.parentElement.querySelectorAll("[data-value]");
      siblings.forEach((s) => s.classList.toggle("is-on", s === chip));
    });

    const encode = (d) => Object.keys(d).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(d[k])).join("&");

    const submitToNetlify = () => {
      const payload = {
        "form-name": "inquiry",
        name: state.data.name,
        email: state.data.email,
        travelers: state.data.travelers,
        month: state.data.month,
        dream: state.data.dream,
        budget: state.data.budget,
      };
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(payload),
      }).catch(() => { /* silent: Netlify captures on production build */ });
    };

    const showErr = (step) => {
      const el = form.querySelector(`[data-err-for="${step}"]`);
      if (el) el.hidden = false;
    };
    const hideErr = (step) => {
      const el = form.querySelector(`[data-err-for="${step}"]`);
      if (el) el.hidden = true;
    };

    const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());

    const validateStep = (step) => {
      const invalid = [];
      if (step === 0) {
        if (!state.data.name.trim()) invalid.push(form.querySelector('input[name="name"]'));
        if (!emailOk(state.data.email)) invalid.push(form.querySelector('input[name="email"]'));
      } else if (step === 1) {
        if (!state.data.travelers || !state.data.month) return false;
      } else if (step === 2) {
        if (!state.data.dream.trim()) invalid.push(form.querySelector('textarea[name="dream"]'));
        if (!state.data.budget) return false;
      }
      // mark invalid inputs (visual cue)
      form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
      invalid.forEach((el) => el && el.classList.add("is-invalid"));
      if (step === 0) return !!state.data.name.trim() && emailOk(state.data.email);
      if (step === 2) return !!state.data.dream.trim() && !!state.data.budget;
      return true;
    };

    btnNext.addEventListener("click", () => {
      if (state.step < TOTAL) {
        if (!validateStep(state.step)) {
          showErr(state.step);
          return;
        }
        hideErr(state.step);
        const submitting = state.step === TOTAL - 1;
        state.step += 1;
        if (state.step === TOTAL) {
          sentName.textContent = `Thanks, ${state.data.name || "friend"}. Amy will write back within two days, usually sooner.`;
          sentEmail.textContent = `Keep an eye on ${state.data.email || "your inbox"}.`;
          if (submitting) submitToNetlify();
        }
        render();
      }
    });

    btnBack.addEventListener("click", () => {
      state.step = Math.max(0, state.step - 1);
      render();
    });

    form.addEventListener("submit", (e) => e.preventDefault());
    render();
  }
})();
