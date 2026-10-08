/* ============================================================
   Damac Énergie — landing boiler thermodynamique (v2, 24/09/2026, retour Thomas)
   1) Questionnaire : une question par écran, avance automatique, prix installé AVANT coordonnées
   2) Prix TVAC installé (6 % / 21 %, pose standard ; supplément si pièce < 20 m²), promo jusqu'à FIN_PROMO
   3) Bloc prime affiché jusqu'à FIN_PRIME puis masqué automatiquement (section, question audit, FAQ, note)
   4) Identifiants publicitaires en sessionStorage, consentement (Consent Mode v2 + Clarity)
   5) Envoi vers le connecteur Odoo existant (Apps Script) puis merci.html ; conversions appel / WhatsApp
   ============================================================ */

const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbx6_3zuQB1ClDu_HpQQQwu4naeGpc6NjILEOkv2iq_aKuXy7g0ZsXszzl03z-bGbL7I/exec";
const ENVOI_REEL = true;   // APERÇU : false = aucun envoi vers Odoo. Passer à true à la mise en ligne, puis faire le test de bout en bout.
const CONV_TEL = "AW-18251567891/3ApyCIbR4owdEJOmg_9D";
const CONV_WA  = "AW-18251567891/bI4ZCInR4owdEJOmg_9D";
const TEL_AFFICHE = "071 55 63 59";
const SECOURS = { url: "https://docs.google.com/forms/d/e/1FAIpQLSc9DWqz5gRuzsoNtTQGMfOdKK2cuQhLp5R4vLA0PR2U-LTqww/formResponse", lid: "entry.488066205", tel: "entry.786146533", origine: "entry.1430959173", gclid: "entry.880895264", page: "entry.1752523108" };   // journal de secours (Google Form, journal_secours.py)

const FIN_PROMO = new Date("2026-09-28T13:00:00+02:00");   // promo retirée par Hakim le 28/09 (« trop court »), lancement pub le 28/09 au prix normal
const FIN_PRIME = new Date("2026-09-28T13:00:00+02:00");   // prime intenable pour un nouveau client (Quentin 25/09) : retirée avec la promo
const PRIX = { promo: 3000, normal: 3450 };                // HTVA, livré et installé (pose standard), affiché TVAC 6 % et 21 %
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
  // 07/10 : pose standard (aucun supplément) → prix ferme, plus de « dès » (le visiteur vient chercher SON prix)
  const standard = !Object.values(etat.supps).some(Boolean);
  const des = $("#offre-des"), ferme = $("#offre-ferme");
  if (des) des.hidden = standard;
  if (ferme) ferme.hidden = !standard;
  // 03/10 : WhatsApp pré-rempli avec les réponses du quiz (Thomas reçoit la situation + la réf. de l'annonce)
  const wa = $("#wa-resultat");
  if (wa){
    let ref = ""; try{ ref = sessionStorage.getItem("dm_ref") || ""; }catch(e){}
    const txt = "Bonjour, je souhaite confirmer mon prix pour le boiler Atlantic Explorer V5 (" + (standard ? "" : "dès ") + euros(prixHTVA * 1.06) + " TVAC"
      + (standard ? ", pose standard" : "") + "). "
      + "Boiler actuel : " + (etat.boiler_actuel || "?") + " · emplacement : " + (etat.emplacement || "?") + " · code postal : " + (etat.code_postal || "?")
      + "." + (ref ? " (réf. " + ref + ")" : "");
    try{ const u = new URL(wa.href); u.searchParams.set("text", txt); wa.href = u.toString(); }catch(e){}
  }
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
  // 03/10 : chaque blocage est compté dans Clarity (form_erreur_*) pour voir pourquoi un formulaire commencé n'est pas envoyé
  const dire = (t, k) => { err.textContent = t; err.hidden = false; evt("form_erreur_" + k); return false; };
  if (nom.length < 2) return dire("Indiquez votre prénom et votre nom.", "nom");
  if (!/^(\+32\d{8,9}|0\d{8,9}|0032\d{8,9}|\+352\d{6,9})$/.test(tel)) return dire("Vérifiez votre numéro de téléphone (ex. 0484 12 34 56).", "tel");
  if (!$("#consent").checked) return dire("Cochez la case pour que nous puissions vous rappeler.", "case");
  if ($("#website").value || (Date.now() - T0 < 3000)) return dire("Réessayez dans un instant.", "rapide");
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
    "Prix affiché : dès " + euros(prixHTVA * 1.06) + " TVAC (6 %) ou " + euros(prixHTVA * 1.21) + " TVAC (21 %), livraison et installation standard comprises" + (promoActive ? " (offre jusqu'au 30/09)" : ""),
    (supps.length ? "Pose NON standard probable : " + supps.join(" ; ") + " → supplément à expliquer au téléphone" : "Pose standard probable (à confirmer avec le client)"),
    "→ Contacter le client dans la journée (SMS ou appel) : confirmer le prix, répondre aux questions",
    "Cookies de mesure : " + consentLu()   // décide si la demande peut être renvoyée à Google (importer_ventes_boiler.py)
  ].filter(Boolean).join(" | ");
}
function consentLu(){
  let v = null; try{ v = localStorage.getItem("damac_consent"); }catch(e){}
  return v === "granted" ? "acceptés" : v === "denied" ? "refusés" : "sans réponse";
}

function initEnvoi(){
  const form = $("#lead-form"), err = $("#form-err");
  let commence = false;
  $(".q[data-key='contact']").addEventListener("focusin", () => { if (!commence){ commence = true; evt("contact_start"); } });
  const waRes = $("#wa-resultat"); if (waRes) waRes.addEventListener("click", () => evt("wa_resultat"));
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (etapes[idx].dataset.key !== "contact") return;
    if (!valider(err)) return;
    remplirCaches();
    $("#message").value = resume();
    evt("lead_ok");
    envoyer({}, "", form.querySelector("button[type=submit]"), err);
  });
}

/* Envoi commun (formulaire complet ET capture rapide) : connecteur Odoo puis merci.html (conversion « Formulaire devis »).
   `champs` remplace les valeurs du formulaire complet ; les champs cachés (GCLID, utm, page, cookies) viennent de #lead-form. */
function envoyer(champs, suffixe, btn, err){
  const lid = (param("test") === "1" ? "test-" : "dm-") + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const qs = new URLSearchParams({ lid: lid });
  ["gclid","gbraid","wbraid"].forEach(k => { const v = param(k) || idStocke(k); if (v) qs.set(k, v); });
  const dest = "merci.html?" + qs.toString() + suffixe;
  try{ sessionStorage.setItem("dm_lead_ok", String(Date.now())); sessionStorage.setItem("dm_lid", lid); }catch(x){}
  if (!ENVOI_REEL){ location.href = dest + "&apercu=1"; return; }
  const payload = new URLSearchParams(new FormData($("#lead-form")));
  payload.delete("tel_rapide");
  Object.entries(champs).forEach(([k, v]) => payload.set(k, v));
  payload.set("lid", lid);
  secours(lid, payload.get("telephone"), payload.get("nom"), payload.get("gclid"));
  const libelle = btn.innerHTML;
  btn.disabled = true; btn.textContent = "Envoi…";
  fetch(FORM_ENDPOINT, { method:"POST", mode:"no-cors", body:payload, keepalive:true })
    .then(() => { location.href = dest; })
    .catch(() => {
      err.textContent = "Une erreur est survenue. Appelez-nous au " + TEL_AFFICHE + " ou réessayez."; err.hidden = false;
      btn.disabled = false; btn.innerHTML = libelle;
    });
}

function secours(lid, tel, origine, gclid){   // 08/10 : copie de chaque demande hors Apps Script (raté du connecteur → demande perdue sans le savoir)
  if (!ENVOI_REEL) return;
  try{ const f = new URLSearchParams(); f.set(SECOURS.lid, lid); f.set(SECOURS.tel, tel || ""); f.set(SECOURS.origine, origine || ""); f.set(SECOURS.gclid, gclid || ""); f.set(SECOURS.page, location.pathname);
       fetch(SECOURS.url, { method:"POST", mode:"no-cors", body:f, keepalive:true }); }catch(e){}
}

/* ---------- 3 bis) Capture rapide « offre par SMS » (07/10/2026) ----------
   Clarity 04-07/10 : 85 % des visiteurs partent sans toucher au quiz, et 0 des 9 qui ont vu leur prix n'a agi.
   Un seul champ (GSM) en haut de page, sur l'écran du prix (et sur les sous-pages via pages.js). */
function initRapide(){
  $$(".rapide").forEach(bloc => {
    const input = $("input[name=tel_rapide]", bloc), err = $(".err", bloc);
    const btn = $("button", bloc), origine = bloc.dataset.origine || "page";
    let vu = false;
    input.addEventListener("focus", () => { if (!vu){ vu = true; evt("sms_start"); } });
    const go = (e) => {
      if (e) e.preventDefault();
      const tel = (input.value || "").replace(/[\s.\/-]/g, "");
      if (!/^(\+32\d{8,9}|0\d{8,9}|0032\d{8,9}|\+352\d{6,9})$/.test(tel)){
        err.textContent = "Vérifiez votre numéro (ex. 0484 12 34 56)."; err.hidden = false; evt("sms_erreur_tel"); input.focus(); return;
      }
      if ($("#website").value || (Date.now() - T0 < 3000)){ err.textContent = "Réessayez dans un instant."; err.hidden = false; return; }
      err.hidden = true;
      remplirCaches();
      const quizFait = !!etat.code_postal;
      const msg = "DEMANDE : devis gratuit PAR SMS promis dans la journée (formulaire rapide, " + origine + "). 1) SMS avec le prix le jour même 2) puis appel ; WhatsApp seulement si le client le propose. | "
        + (quizFait ? resume() : "Quiz non rempli | Cookies de mesure : " + consentLu());
      evt("sms_ok");
      envoyer({ nom: "Offre par SMS (" + origine + ")", telephone: input.value.trim(), email: "", consentement: "oui", message: msg },
              "&sms=1", btn, err);
    };
    if (bloc.tagName === "FORM") bloc.addEventListener("submit", go);
    else btn.addEventListener("click", go);
    input.addEventListener("keydown", e => { if (e.key === "Enter") go(e); });
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
  // fenêtre à choix : le focus démarre sur Refuser et la tabulation reste dans la fenêtre tant qu'aucun choix n'est fait
  const ouvrir = () => { b.hidden = false; try{ $("#cookie-no").focus({preventScroll:true}); }catch(e){} };
  const fermer = (v) => { try{ localStorage.setItem("damac_consent", v); }catch(e){} appliquer(v === "granted"); balise(v); b.hidden = true; };
  b.addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const btns = [...b.querySelectorAll("a[href], button")], i = btns.indexOf(document.activeElement);
    e.preventDefault(); btns[(i + (e.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
  });
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
  // référence courte dans le message WhatsApp : « G- » + fin du gclid (rapprochée de click_view) ou « S- » sans annonce
  let ref = ""; try{ ref = sessionStorage.getItem("dm_ref") || ""; }catch(e){}
  if (!ref){
    const g = idStocke("gclid") || idStocke("gbraid") || idStocke("wbraid");
    ref = g ? "G-" + g.slice(-6) : "S-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    try{ sessionStorage.setItem("dm_ref", ref); }catch(e){}
  }
  $$('a[href*="wa.me"]').forEach(a => {
    try{ const u = new URL(a.href); u.searchParams.set("text", (u.searchParams.get("text") || "Bonjour, je souhaite un prix pour le boiler thermodynamique Atlantic.") + " (réf. " + ref + ")"); a.href = u.toString(); }catch(e){}
  });
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
  initRapide();
  initContacts();
  initBarre();
});
