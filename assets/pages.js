/* ============================================================
   Damac Énergie — sous-pages boiler (cibles des liens annexes de l'annonce, 04/10/2026)
   Même logique que app.js, sans questionnaire :
   1) identifiants publicitaires gardés en sessionStorage (clés dm_gclid…, relues par le questionnaire de la page d'accueil)
   2) liens internes : les paramètres de l'annonce (utm_term = mot-clé) suivent le visiteur jusqu'au formulaire
   3) consentement : fenêtre à choix (Consent Mode v2 + Clarity)
   4) conversions secondaires appel / WhatsApp, référence « G-… » dans le message WhatsApp
   ============================================================ */
(function(){
  const CONV_TEL = "AW-18251567891/3ApyCIbR4owdEJOmg_9D";
  const CONV_WA  = "AW-18251567891/bI4ZCInR4owdEJOmg_9D";
  const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbx6_3zuQB1ClDu_HpQQQwu4naeGpc6NjILEOkv2iq_aKuXy7g0ZsXszzl03z-bGbL7I/exec";
  const ENVOI_REEL = true;   // passé à true par deploy_boiler_github.py (comme app.js)
  const T0 = Date.now();
  const SECOURS = { url: "https://docs.google.com/forms/d/e/1FAIpQLSc9DWqz5gRuzsoNtTQGMfOdKK2cuQhLp5R4vLA0PR2U-LTqww/formResponse", lid: "entry.488066205", tel: "entry.786146533", origine: "entry.1430959173", gclid: "entry.880895264", page: "entry.1752523108" };   // journal de secours (Google Form, journal_secours.py)

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const evt = (n) => { if (typeof clarity === "function") clarity("event", n); };
  const qs = new URLSearchParams(location.search);
  const idStocke = (k) => { try{ return sessionStorage.getItem("dm_" + k) || ""; }catch(e){ return ""; } };

  // 1) identifiants publicitaires
  ["gclid","gbraid","wbraid"].forEach(k => { const v = qs.get(k); if (v){ try{ sessionStorage.setItem("dm_" + k, v); }catch(e){} } });

  // 2) liens internes
  if (location.search) $$('a[href^="/"]').forEach(a => {
    try{ const u = new URL(a.getAttribute("href"), location.origin); if (!u.search) a.setAttribute("href", u.pathname + location.search + u.hash); }catch(e){}
  });

  // 3) consentement
  function appliquer(accord){
    const v = accord ? "granted" : "denied";
    if (typeof gtag === "function") gtag("consent", "update", {ad_storage:v, ad_user_data:v, ad_personalization:v, analytics_storage:v});
    if (typeof clarity === "function") clarity("consentv2", {ad_Storage:v, analytics_Storage:v});
  }
  const b = $("#cookie");
  let choix = null; try{ choix = localStorage.getItem("damac_consent"); }catch(e){}
  const ouvrir = () => { b.hidden = false; try{ $("#cookie-no").focus({preventScroll:true}); }catch(e){} };
  const fermer = (v) => { try{ localStorage.setItem("damac_consent", v); }catch(e){} appliquer(v === "granted"); b.hidden = true; };
  if (choix === "granted") appliquer(true); else if (choix === "denied") appliquer(false); else ouvrir();
  $("#cookie-ok").addEventListener("click", () => fermer("granted"));
  $("#cookie-no").addEventListener("click", () => fermer("denied"));
  const r = $("#cookie-reouvrir"); if (r) r.addEventListener("click", ouvrir);
  b.addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const btns = Array.from(b.querySelectorAll("a[href], button")), i = btns.indexOf(document.activeElement);
    e.preventDefault(); btns[(i + (e.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
  });

  // 4) conversions secondaires
  $$('a[href^="tel:"]').forEach(a => a.addEventListener("click", () => {
    if (typeof gtag === "function") gtag("event", "conversion", {send_to: CONV_TEL});
    evt("tel_click");
  }));
  let ref = ""; try{ ref = sessionStorage.getItem("dm_ref") || ""; }catch(e){}
  const g = idStocke("gclid") || idStocke("gbraid") || idStocke("wbraid");
  if (!ref || (g && ref.startsWith("S-"))){   // arrivé d'une annonce après une visite sans : la réf. « G- » l'emporte
    ref = g ? "G-" + g.slice(-6) : "S-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    try{ sessionStorage.setItem("dm_ref", ref); }catch(e){}
  }
  $$('a[href*="wa.me"]').forEach(a => {
    try{ const u = new URL(a.href); u.searchParams.set("text", (u.searchParams.get("text") || "Bonjour, je souhaite un prix pour le boiler thermodynamique Atlantic.") + " (réf. " + ref + ")"); a.href = u.toString(); }catch(e){}
    a.addEventListener("click", () => { if (typeof gtag === "function") gtag("event", "conversion", {send_to: CONV_WA}); evt("whatsapp_click"); });
  });
  $$("a.btn-prix").forEach(a => a.addEventListener("click", () => evt("sous_page_vers_prix")));

  // 5) capture rapide « offre par SMS » (07/10/2026) : un seul champ, même connecteur Odoo, merci.html?sms=1 (conversion « Formulaire devis »)
  $$(".rapide").forEach(bloc => {
    const input = bloc.querySelector("input[name=tel_rapide]"), err = bloc.querySelector(".err"), btn = bloc.querySelector("button");
    let vu = false;
    input.addEventListener("focus", () => { if (!vu){ vu = true; evt("sms_start"); } });
    bloc.addEventListener("submit", e => {
      e.preventDefault();
      const tel = (input.value || "").replace(/[\s.\/-]/g, "");
      if (!/^(\+32\d{8,9}|0\d{8,9}|0032\d{8,9}|\+352\d{6,9})$/.test(tel)){
        err.textContent = "Vérifiez votre numéro (ex. 0484 12 34 56)."; err.hidden = false; evt("sms_erreur_tel"); input.focus(); return;
      }
      if (Date.now() - T0 < 3000){ err.textContent = "Réessayez dans un instant."; err.hidden = false; return; }
      err.hidden = true;
      let consent = null; try{ consent = localStorage.getItem("damac_consent"); }catch(x){}
      const ck = consent === "granted" ? "acceptés" : consent === "denied" ? "refusés" : "sans réponse";
      const origine = "sous-page " + (document.body.dataset.page || "");
      const lid = (qs.get("test") === "1" ? "test-" : "dm-") + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const p = new URLSearchParams({
        nom: "Offre par SMS (" + origine + ")", telephone: input.value.trim(), email: "", consentement: "oui", website: "",
        produit: "Boiler thermodynamique Atlantic Explorer V5", consent_ads: consent || "unset", lid: lid,
        message: "DEMANDE : devis gratuit PAR SMS promis dans la journée (formulaire rapide, " + origine + "). 1) SMS avec le prix le jour même 2) puis appel ; WhatsApp seulement si le client le propose. | Quiz non rempli | Cookies de mesure : " + ck,
        page_origine: location.href, referrer: document.referrer });
      ["gclid","gbraid","wbraid"].forEach(k => { const v = qs.get(k) || idStocke(k); if (v) p.set(k, v); });
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","utm_adgroup"].forEach(k => { const v = qs.get(k); if (v) p.set(k, v); });
      const dest = "/merci.html?" + new URLSearchParams({lid: lid}).toString() + (p.get("gclid") ? "&gclid=" + encodeURIComponent(p.get("gclid")) : "") + "&sms=1";
      try{ sessionStorage.setItem("dm_lead_ok", String(Date.now())); sessionStorage.setItem("dm_lid", lid); }catch(x){}
      evt("sms_ok");
      if (!ENVOI_REEL){ location.href = dest + "&apercu=1"; return; }
      try{ const f = new URLSearchParams(); f.set(SECOURS.lid, lid); f.set(SECOURS.tel, p.get("telephone")); f.set(SECOURS.origine, p.get("nom")); f.set(SECOURS.gclid, p.get("gclid") || ""); f.set(SECOURS.page, location.pathname);
           fetch(SECOURS.url, {method: "POST", mode: "no-cors", body: f, keepalive: true}); }catch(x){}   // journal de secours
      const libelle = btn.innerHTML; btn.disabled = true; btn.textContent = "Envoi…";
      fetch(FORM_ENDPOINT, {method: "POST", mode: "no-cors", body: p, keepalive: true})
        .then(() => { location.href = dest; })
        .catch(() => { err.textContent = "Une erreur est survenue. Appelez-nous au 071 55 63 59 ou réessayez."; err.hidden = false; btn.disabled = false; btn.innerHTML = libelle; });
    });
  });
  evt("sous_page_" + (document.body.dataset.page || "inconnue"));
})();
