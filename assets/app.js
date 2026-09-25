/* ============================================================
   Damac Énergie — landing boiler thermodynamique (v2, 24/09/2026, retour Thomas)
   1) Questionnaire : une question par écran, avance automatique, prix de l'appareil AVANT coordonnées
   2) Prix HTVA de l'appareil (installation à part, selon la pièce), promo jusqu'à FIN_PROMO
   3) Bloc prime affiché jusqu'à FIN_PRIME puis masqué automatiquement (section, question audit, FAQ, note)
   4) Identifiants publicitaires en sessionStorage, consentement (Consent Mode v2 + Clarity)
   5) Envoi vers le connecteur Odoo existant (Apps Script) puis merci.html ; conversions appel / WhatsApp
   ============================================================ */

const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbx6_3zuQB1ClDu_HpQQQwu4naeGpc6NjILEOkv2iq_aKuXy7g0ZsXszzl03z-bGbL7I/exec";
const ENVOI_REEL = true;   // APERÇU : false = aucun envoi vers Odoo. Passer à true à la mise en ligne, puis faire le test de bout en bout.
const CONV_TEL = "AW-18269579591/Ct0YCPjE-cscEMfSzodE";
const CONV_WA  = "AW-18269579591/ae2tCPvE-cscEMfSzodE";
const TEL_AFFICHE = "071 55 63 59";
const FIN_PROMO = new Date("2026-09-30T23:59:59+02:00");   // confirmé par Damac le 25/09 : jusqu'à la fin des primes
const FIN_PRIME = new Date("2026-09-30T23:59:59+02:00");   // clôture du régime wallon actuel
const PRIX = { promo: 3000, normal: 3450 };                // HTVA, appareil seul
const T0 = Date.now();
const MAINTENANT = new Date(param("date") || Date.now());  // ?date=2026-10-01 pour tester l'après-promo

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const evt = (nom) => { if (typeof clarity === "function") clarity("event", nom); };
const euros = (n) => Math.round(n).toLocaleString("fr-BE").replace(/ | /g, " ") + " €";

function param(n){ return new URLSearchParams(location.search).get(n); }

/* ---------- 0) Période : promo et prime ---------- */
const promoActive = MAINTENANT <= FIN_PROMO;
const primeActive = MAINTENANT <= FIN_PRIME;
const prixHTVA = promoActive ? PRIX.promo : PRIX.normal;
function appliquerPeriode(){
  $$(".js-prix").forEach(e => e.textContent = euros(prixHTVA));
  $$(".js-prix-6").forEach(e => e.textContent = euros(prixHTVA * 1.06));
  $$(".js-prix-21").forEach(e => e.textContent = euros(prixHTVA * 1.21));
  if (!promoActive){ $$(".js-promo").forEach(e => e.remove()); document.title = document.title.replace("3 000 €", euros(PRIX.normal)); }
  if (!primeActive) $$(".js-prime").forEach(e => e.remove());
}

/* ---------- 1) Identifiants publicitaires ---------- */
function garderIds(){
  ["gclid","gbraid","wbraid"].forEach(k => { const v = param(k); if (v){ try{ sessionStorage.setItem("dm_"+k, v); }catch(e){} } });
}
function idStocke(k){ try{ return sessionStorage.getItem("dm_"+k) || ""; }catch(e){ return ""; } }
function remplirCaches(){
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
  ["gclid","gbraid","wbraid"].forEach(k => set(k, param(k) || idStocke(k)));
  ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","utm_adgroup"].forEach(k => set(k, param(k)));
  set("page_origine", location.href);
  set("referrer", document.referrer);
  try{ set("consent_ads", localStorage.getItem("damac_consent") || "unset"); }catch(e){}
}

/* ---------- 2) Questionnaire (étapes calculées depuis la page) ---------- */
const etat = { supps: {} };
let etapes = [], idx = 0;
const historique = [];

function progression(i){ return Math.round(8 + 88 * i / Math.max(1, etapes.length - 1)); }
function afficher(i, focus){
  etapes[idx].classList.remove("is-active");
  idx = i;
  const q = etapes[idx];
  q.classList.add("is-active");
  const p = progression(idx);
  $("#quiz-fill").style.width = p + "%";
  $(".quiz__bar").setAttribute("aria-valuenow", p);
  $("#quiz-back").hidden = (idx === 0);
  if (focus !== false){
    const cible = q.querySelector("input:not([type=hidden]):not(.hp), .opt, #reserver, legend");
    if (cible){ if (cible.tagName === "LEGEND") cible.setAttribute("tabindex", "-1"); cible.focus({preventScroll:true}); }
    const haut = $("#lead-form").getBoundingClientRect().top;
    if (haut < 70 || haut > innerHeight * .6) $("#lead-form").scrollIntoView({behavior:"smooth", block:"start"});
  }
}
function suivant(){ historique.push(idx); afficher(idx + 1); }
function etapeDe(cle){ return etapes.findIndex(q => q.dataset.key === cle); }

function preparerResultat(){
  const liste = $("#offre-supps");
  liste.innerHTML = "";
  Object.values(etat.supps).filter(Boolean).forEach(t => { const li = document.createElement("li"); li.textContent = "Supplément probable : " + t; liste.appendChild(li); });
  const cp = $("#coche-prime");
  if (cp) cp.hidden = !(primeActive && etat.audit === "Audit logement : oui");
}

function initQuiz(){
  etapes = $$(".q");
  $$(".q .opt").forEach(b => b.addEventListener("click", () => {
    const q = b.closest(".q");
    $$(".opt", q).forEach(o => o.classList.remove("is-choisi"));
    b.classList.add("is-choisi");
    etat[q.dataset.key] = b.dataset.value;
    etat.supps[q.dataset.key] = b.dataset.supp || "";
    evt("quiz_" + q.dataset.key);
    setTimeout(suivant, 220);
  }));

  $("#quiz-back").addEventListener("click", () => {
    const prec = historique.pop();
    if (prec === undefined) return;
    afficher(prec);
  });

  const cp = $("#cp"), cpErr = $("#cp-err");
  const voir = () => {
    const v = (cp.value || "").trim();
    if (!/^\d{4}$/.test(v)){ cpErr.textContent = "Indiquez un code postal belge à 4 chiffres."; cpErr.hidden = false; cp.focus(); return; }
    const n = Number(v);
    const enZone = (n >= 1000 && n <= 1499) || (n >= 4000 && n <= 7999);
    etat.code_postal = v;
    etat.hors_zone = !enZone;
    if (!enZone){ cpErr.textContent = "Cette zone n'est peut-être pas couverte par notre installateur. Nous vérifions pour vous au rappel."; cpErr.hidden = false; }
    else cpErr.hidden = true;
    preparerResultat();
    evt("prix_vu");
    setTimeout(() => { historique.push(idx); afficher(etapeDe("resultat")); }, enZone ? 0 : 900);
  };
  $("#voir-prix").addEventListener("click", voir);
  cp.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); voir(); } });
  cp.addEventListener("input", () => { cp.value = cp.value.replace(/\D/g, "").slice(0, 4); cpErr.hidden = true; });

  $("#reserver").addEventListener("click", () => { evt("reserver_clic"); historique.push(idx); afficher(etapeDe("contact")); });

  $$("[data-scroll]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    $("#prix").scrollIntoView({behavior:"smooth", block:"start"});
    setTimeout(() => { const o = $(".q.is-active .opt, .q.is-active input:not([type=hidden]):not(.hp)"); if (o) o.focus({preventScroll:true}); }, 500);
  }));
  $("#quiz-fill").style.width = progression(0) + "%";
}

/* ---------- 3) Envoi ---------- */
function valider(err){
  const nom = ($("#nom").value || "").trim();
  const tel = ($("#tel").value || "").replace(/[\s.\/-]/g, "");
  const dire = t => { err.textContent = t; err.hidden = false; return false; };
  if (nom.length < 2) return dire("Indiquez votre prénom et votre nom.");
  if (!/^(\+32\d{8,9}|0\d{8,9}|\+352\d{6,9})$/.test(tel)) return dire("Vérifiez votre numéro de téléphone (ex. 0484 12 34 56).");
  if (!$("#consent").checked) return dire("Cochez la case pour que nous puissions vous rappeler.");
  if ($("#website").value || (Date.now() - T0 < 3000)) return dire("Réessayez dans un instant.");
  err.hidden = true;
  return true;
}

function resume(){
  const supps = Object.values(etat.supps).filter(Boolean);
  return [
    "Boiler actuel : " + (etat.boiler_actuel || "?"),
    "Emplacement : " + (etat.emplacement || "?"),
    "Pièce : " + (etat.surface || "?"),
    "Foyer : " + (etat.personnes || "?") + " (capacité à conseiller)",
    primeActive ? (etat.audit || "Audit logement : non répondu") : "",
    "Code postal : " + (etat.code_postal || "?") + (etat.hors_zone ? " (HORS ZONE à vérifier)" : ""),
    "Prix affiché : dès " + euros(prixHTVA) + " HTVA appareil seul" + (promoActive ? " (offre jusqu'au 30/09)" : ""),
    "Installation à chiffrer sur photos" + (supps.length ? " — suppléments probables : " + supps.join(" ; ") : ""),
    "→ Demander les photos du boiler actuel et de la pièce par WhatsApp"
  ].filter(Boolean).join(" | ");
}

function initEnvoi(){
  const form = $("#lead-form"), err = $("#form-err");
  let commence = false;
  $(".q[data-key='contact']").addEventListener("focusin", () => { if (!commence){ commence = true; evt("contact_start"); } });
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (etapes[idx].dataset.key !== "contact") return;
    if (!valider(err)) return;
    remplirCaches();
    $("#message").value = resume();
    const lid = (param("test") === "1" ? "test-" : "dm-") + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const qs = new URLSearchParams({ lid: lid });
    ["gclid","gbraid","wbraid"].forEach(k => { const v = param(k) || idStocke(k); if (v) qs.set(k, v); });
    const dest = "merci.html?" + qs.toString();
    try{ sessionStorage.setItem("dm_lead_ok", String(Date.now())); sessionStorage.setItem("dm_lid", lid); }catch(x){}
    evt("lead_ok");
    if (!ENVOI_REEL){ location.href = dest + "&apercu=1"; return; }
    const payload = new URLSearchParams(new FormData(form));
    payload.set("lid", lid);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Envoi en cours…";
    fetch(FORM_ENDPOINT, { method:"POST", mode:"no-cors", body:payload, keepalive:true })
      .then(() => { location.href = dest; })
      .catch(() => {
        err.textContent = "Une erreur est survenue. Appelez-nous au " + TEL_AFFICHE + " ou réessayez."; err.hidden = false;
        btn.disabled = false; btn.textContent = "Recevoir mon prix installé";
      });
  });
}

/* ---------- 4) Consentement ---------- */
function appliquer(accord){
  if (typeof gtag === "function") gtag('consent','update',{ad_storage:accord?'granted':'denied',ad_user_data:accord?'granted':'denied',ad_personalization:accord?'granted':'denied',analytics_storage:accord?'granted':'denied'});
  if (typeof clarity === "function") clarity('consentv2',{ad_Storage:accord?'granted':'denied',analytics_Storage:accord?'granted':'denied'});
  const c = document.getElementById("consent_ads"); if (c) c.value = accord ? "granted" : "denied";
}
function balise(v){ if (!ENVOI_REEL) return; try{ fetch(FORM_ENDPOINT + "?evt=consent&v=" + v, {method:"GET", mode:"no-cors", keepalive:true}); }catch(e){} }
function initCookies(){
  const b = $("#cookie");
  let choix = null; try{ choix = localStorage.getItem("damac_consent"); }catch(e){}
  const ouvrir = () => { b.hidden = false; };
  const fermer = (v) => { try{ localStorage.setItem("damac_consent", v); }catch(e){} appliquer(v === "granted"); balise(v); b.hidden = true; };
  if (choix === "granted") appliquer(true); else if (choix === "denied") appliquer(false); else ouvrir();
  $("#cookie-ok").addEventListener("click", () => fermer("granted"));
  $("#cookie-no").addEventListener("click", () => fermer("denied"));
  $("#cookie-reouvrir").addEventListener("click", ouvrir);
}

/* ---------- 5) Conversions secondaires ---------- */
function montrerNumero(){
  // numéro lu dans l'en-tête au moment du clic : Google le remplace par son numéro de suivi pour les visiteurs venus d'une annonce
  const n = ($(".nav__tel span") || {}).textContent || TEL_AFFICHE;
  let t = $("#toast-tel");
  if (!t){ t = document.createElement("div"); t.id = "toast-tel"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.innerHTML = "Appelez-nous au <b></b> depuis votre téléphone.";
  t.querySelector("b").textContent = n.trim();
  t.hidden = false;
  clearTimeout(montrerNumero.minuterie);
  montrerNumero.minuterie = setTimeout(() => { t.hidden = true; }, 7000);
}
function initContacts(){
  $$("a.note-google").forEach(a => a.addEventListener("click", () => evt("avis_google_clic")));
  $$('a[href^="tel:"]').forEach(a => a.addEventListener("click", () => {
    if (typeof gtag === "function") gtag('event','conversion',{ send_to: CONV_TEL });
    evt("tel_click");
    // sur ordinateur, le lien tel: ne fait rien sans application d'appel : on affiche le numéro
    if (matchMedia("(hover: hover) and (pointer: fine)").matches) montrerNumero();
  }));
  $$('a[href*="wa.me"]').forEach(a => a.addEventListener("click", () => {
    if (typeof gtag === "function") gtag('event','conversion',{ send_to: CONV_WA });
    evt("whatsapp_click");
  }));
}

/* ---------- Barre mobile : visible hors héros et hors questionnaire ---------- */
function initBarre(){
  const barre = $("#barre"); if (!barre || !("IntersectionObserver" in window)) return;
  let heroVisible = true, quizVisible = false;
  const maj = () => {
    const on = !heroVisible && !quizVisible;
    barre.classList.toggle("is-on", on);
    barre.setAttribute("aria-hidden", on ? "false" : "true");
    $$("a", barre).forEach(a => a.tabIndex = on ? 0 : -1);
  };
  new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; maj(); }).observe($(".hero"));
  new IntersectionObserver(es => { quizVisible = es[0].isIntersecting; maj(); }, {threshold:.15}).observe($("#prix"));
}

/* ---------- Message de l'annonce (à remplir avec les ID de groupes d'annonces) ---------- */
function messageAnnonce(){
  const MAP = {
    // "ID_GROUPE": { h1: "…", lede: "…" }
  };
  const v = MAP[param("utm_adgroup") || ""];
  if (v){ $(".hero h1").innerHTML = v.h1; $(".hero__lede").innerHTML = v.lede; }
}

document.addEventListener("DOMContentLoaded", () => {
  if (ENVOI_REEL){ const a = $("#apercu"); if (a) a.remove(); }
  appliquerPeriode();
  garderIds();
  messageAnnonce();
  remplirCaches();
  initCookies();
  initQuiz();
  initEnvoi();
  initContacts();
  initBarre();
});
