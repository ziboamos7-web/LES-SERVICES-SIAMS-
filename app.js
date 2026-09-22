// ===== Données du paiement (à remplacer plus tard par Supabase) =====

const paymentData = {
  reference: "#CM-4471",
  amount: "31 500 FCFA",
  receiptDate: "22 sept.",
  agentName: "Awa K.",
  agentInitials: "AK",
  agentStatus: "Agent SIAMS • a pris votre dossier",
  receiptName: "recu_paiement.jpg",
  receiptSent: "Envoyé il y a 8 min",
  estimatedTime: "~ 2 h restantes",
  progress: 70,
  currentStep: 3,
  totalSteps: 4
};

// Emplacement réservé pour une image de reçu réelle (chemin ou base64).
// Si vide, une prévisualisation simulée est affichée à la place.
let receiptImage = "";

// Actuellement : données locales.
// Plus tard, remplacer le contenu de cette fonction par un appel Supabase,
// par ex. via loadPaymentDataFromSupabase().
function loadPaymentData() {
  return paymentData;
}

// ===== Rendu de l'interface =====

function renderTimeline(data) {
  const el = document.getElementById("timeline");
  el.innerHTML = "";
  const total = data.totalSteps;

  for (let i = 1; i <= total; i++) {
    const step = document.createElement("div");
    step.className = "tl-step";
    step.setAttribute("role", "listitem");

    const circle = document.createElement("span");
    circle.className = "tl-circle";

    if (i < data.currentStep) {
      circle.classList.add("done");
      circle.innerHTML =
        '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">' +
        '<path d="M2 5.7 4.3 8 9 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (i === data.currentStep) {
      circle.classList.add("current");
    } else {
      circle.classList.add("pending");
    }

    step.appendChild(circle);

    if (i < total) {
      const line = document.createElement("span");
      line.className = "tl-line" + (i < data.currentStep ? " done" : "");
      step.appendChild(line);
    }

    el.appendChild(step);
  }
}

function renderPaymentInfo(data) {
  document.getElementById("refText").textContent = "Réf. " + data.reference;
  document.getElementById("amountText").textContent = data.amount;
  document.getElementById("receiptDateText").textContent = "Reçu envoyé le " + data.receiptDate;
  document.getElementById("agentInitials").textContent = data.agentInitials;
  document.getElementById("agentName").textContent = data.agentName;
  document.getElementById("agentStatus").textContent = data.agentStatus;
  document.getElementById("receiptName").textContent = data.receiptName;
  document.getElementById("receiptSent").textContent = data.receiptSent;
  document.getElementById("etaText").textContent = data.estimatedTime;
}

function renderProgress(data) {
  document.getElementById("progressFill").style.width = data.progress + "%";
}

function renderPreview() {
  const body = document.getElementById("previewBody");
  if (receiptImage) {
    body.innerHTML = '<img src="' + receiptImage + '" alt="Aperçu du reçu de paiement">';
  }
  // Si receiptImage est vide, le placeholder statique du HTML reste affiché.
}

// ===== Toast =====

let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// ===== Modals =====

function openModal(id) {
  document.getElementById(id).hidden = false;
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

function setupModals() {
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".modal-overlay").hidden = true;
    });
  });
}

// ===== Interactions =====

function setupInteractions() {
  document.getElementById("copyRefBtn").addEventListener("click", () => {
    const text = paymentData.reference;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast("Référence copiée");
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    document.getElementById("lastUpdate").textContent = "À l'instant";
    showToast("Statut actualisé");
  });

  document.getElementById("chatBtn").addEventListener("click", () => {
    openModal("chatModal");
  });

  document.getElementById("previewBtn").addEventListener("click", () => {
    openModal("previewModal");
  });

  document.getElementById("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    const messages = document.getElementById("chatMessages");

    const userBubble = document.createElement("div");
    userBubble.className = "chat-bubble user";
    userBubble.textContent = text;
    messages.appendChild(userBubble);

    input.value = "";
    messages.scrollTop = messages.scrollHeight;

    setTimeout(() => {
      const agentBubble = document.createElement("div");
      agentBubble.className = "chat-bubble agent";
      agentBubble.textContent = "Merci, je reviens vers vous très vite avec une mise à jour.";
      messages.appendChild(agentBubble);
      messages.scrollTop = messages.scrollHeight;
    }, 700);
  });

  const notifSwitch = document.getElementById("notifSwitch");
  let notifOn = false;
  notifSwitch.addEventListener("click", () => {
    notifOn = !notifOn;
    notifSwitch.classList.toggle("on", notifOn);
    notifSwitch.setAttribute("aria-checked", String(notifOn));
    showToast(notifOn ? "Notification activée" : "Notification désactivée");
  });

  document.getElementById("resendBtn").addEventListener("click", () => {
    showToast("Le reçu a été renvoyé.");
  });

  document.getElementById("subscriptionLink").addEventListener("click", () => {
    showToast("Formules d'abonnement bientôt disponibles");
  });

  document.getElementById("floatBtn").addEventListener("click", () => {
    window.scrollBy({ top: 220, behavior: "smooth" });
  });

  // Boutons de la barre supérieure : simples confirmations pour ce prototype.
  document.getElementById("menuBtn").addEventListener("click", () => {
    showToast("Menu");
  });
  document.getElementById("docBtn").addEventListener("click", () => {
    showToast("Mes reçus");
  });
  document.getElementById("addBtn").addEventListener("click", () => {
    showToast("Nouveau paiement");
  });
  document.getElementById("moreBtn").addEventListener("click", () => {
    showToast("Plus d'options");
  });
}

// ===== Initialisation =====

function init() {
  const data = loadPaymentData();
  renderPaymentInfo(data);
  renderTimeline(data);
  renderProgress(data);
  renderPreview();
  setupModals();
  setupInteractions();
}

document.addEventListener("DOMContentLoaded", init);
