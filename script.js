/* =========================
   CONFIG: EmailJS
   =========================
   1) Create EmailJS account
   2) Add Email Service + Email Template
   3) Fill these values
*/
const EMAILJS_PUBLIC_KEY = "QF0MOZngGzxnNGD0K";
const EMAILJS_SERVICE_ID = "service_hqklxq7";
const EMAILJS_TEMPLATE_ID = "template_qr3x84j";
const RECIPIENT_EMAIL = "emmanuel.tecson@jmc.edu.ph";

/*
Template variables suggestion (in EmailJS template):
- subject
- message
- page
*/

const STORAGE_KEY = "purpleBookState_v1";
const FLIP_MS = 1600;

const book = document.getElementById("book");
const coverFront = document.getElementById("coverFront");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageNum = document.getElementById("pageNum");
const statusText = document.getElementById("statusText");

const markReadBtn = document.getElementById("markReadBtn");

const dateLeemBtn = document.getElementById("dateLeemBtn");
const noDateLeemBtn = document.getElementById("noDateLeemBtn");
const readLockNote = document.getElementById("readLockNote");

const page1Content = document.getElementById("page1Content");
const page2Content = document.getElementById("page2Content");
const resultArea = document.getElementById("resultArea");

const page1Eraser = document.getElementById("page1Eraser");
const page2Eraser = document.getElementById("page2Eraser");

const defaultState = {
  opened: false,
  currentPage: 0, // 0 = cover, 1 = page1, 2 = page2
  markedRead: false,
  decision: null, // "date" | "no-date"
  decisionMessage: null
};

let state = loadState();
let isFlipping = false;
state.opened = true;
if (state.currentPage < 1 || state.currentPage > 2) {
  state.currentPage = 1;
}

/* =========================
   Init
   ========================= */
initEmailJS();
applyStateToUI();

if (coverFront) {
  coverFront.addEventListener("click", () => {
    openBook();
  });
}

if (prevBtn) {
  prevBtn.addEventListener("click", async () => {
    if (!state.opened || isFlipping || state.currentPage <= 1) return;
    await runFlipAnimation(false);
    state.currentPage = Math.max(1, state.currentPage - 1);
    saveState();
    applyStateToUI();
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", async () => {
    if (!state.opened || isFlipping || state.currentPage >= 2) return;
    await runFlipAnimation(false);
    state.currentPage = Math.min(2, state.currentPage + 1);
    saveState();
    applyStateToUI();
  });
}

markReadBtn.addEventListener("click", async () => {
  state.markedRead = true;
  saveState();
  applyStateToUI();

  await notifyEmail({
    subject: "Marked as read",
    message: "Mark as read button was clicked.",
    page: "1"
  });
});

dateLeemBtn.addEventListener("click", async () => {
  await handleDecision("date");
});

noDateLeemBtn.addEventListener("click", async () => {
  await handleDecision("no-date");
});

/* Keyboard navigation */
window.addEventListener("keydown", (e) => {
  if (!state.opened || isFlipping) return;
  if (e.key === "ArrowLeft" && prevBtn) prevBtn.click();
  if (e.key === "ArrowRight" && nextBtn) nextBtn.click();
});

async function openBook() {
  if (state.opened || isFlipping) return;
  await runFlipAnimation(true);
  state.opened = true;
  state.currentPage = Math.max(state.currentPage, 1);
  saveState();
  applyStateToUI();
}

/* =========================
   Decision flow
   ========================= */
async function handleDecision(type) {
  // lock buttons
  dateLeemBtn.disabled = true;
  noDateLeemBtn.disabled = true;

  const msgYes = "really!?!? yeyyy!! >< I'll set a sched for this and make sure madayon ni! thank you raine!!";
  const msgNo = "oh.. it's fine! at least I tried hehe.. :<";

  const emailYes = "yes daw!!! YEYY";
  const emailNo = "its oki.. :(";

  const chosenMessage = (type === "date") ? msgYes : msgNo;
  const chosenEmail = (type === "date") ? emailYes : emailNo;

  // Erase animation on page 2
  setStatus("Erasing...");
  await erasePage(page2Eraser, page2Content);

  // Clear content and write new message
  page2Content.innerHTML = `

    <div class="result-area" id="resultArea"></div>
  `;
  const newResultArea = page2Content.querySelector("#resultArea");

  setStatus("Writing...");
  await handwrite(newResultArea, chosenMessage, 2200);

  // Save state
  state.decision = type;
  state.decisionMessage = chosenMessage;
  saveState();

  // Notify email
  setStatus("Sending email...");
  await notifyEmail({
    subject: "Decision made",
    message: chosenEmail,
    page: "2"
  });

  setStatus("Done");

  // keep disabled after decision (since it's "saved")
  dateLeemBtn.disabled = true;
  noDateLeemBtn.disabled = true;
}

/* =========================
   Animations helpers
   ========================= */
function erasePage(overlayEl, contentEl) {
  return new Promise((resolve) => {
    overlayEl.classList.remove("run");
    // force reflow
    void overlayEl.offsetWidth;

    overlayEl.classList.add("run");

    // fade content slightly during erase
    contentEl.style.transition = "opacity 250ms ease";
    contentEl.style.opacity = "0.15";

    overlayEl.addEventListener("animationend", () => {
      contentEl.style.opacity = "1";
      resolve();
    }, { once: true });
  });
}

function handwrite(container, text, durationMs = 1800) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "handwrite";
    el.style.setProperty("--dur", `${durationMs}ms`);
    el.textContent = text;

    container.innerHTML = "";
    container.appendChild(el);

    // resolve after animation
    setTimeout(resolve, durationMs + 80);
  });
}

/* =========================
   UI state
   ========================= */
function applyStateToUI() {
  // open/close
  if (state.opened) {
    book.classList.add("open");
  } else {
    book.classList.remove("open");
  }

  // page
  book.dataset.page = String(state.currentPage || 0);

  // indicator + nav enable
  if (!state.opened) {
    if (pageNum) pageNum.textContent = "Cover";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = isFlipping;
  } else {
    if (pageNum) pageNum.textContent = `Page ${state.currentPage}`;
    if (prevBtn) prevBtn.disabled = isFlipping || state.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = isFlipping || state.currentPage >= 2;
  }

  // mark read visual
  if (state.markedRead) {
    markReadBtn.innerHTML = `<i class="fa-solid fa-check"></i> Marked`;
    markReadBtn.disabled = true;
  } else {
    markReadBtn.innerHTML = `<i class="fa-regular fa-circle-check"></i> Mark as read`;
    markReadBtn.disabled = false;
  }

  // decision restore
  if (state.decision && state.decisionMessage) {
    // disable choice buttons
    dateLeemBtn.disabled = true;
    noDateLeemBtn.disabled = true;

    // show saved message on page 2
    page2Content.innerHTML = `
      <div class="result-area" id="resultArea"></div>
    `;
    const newResultArea = page2Content.querySelector("#resultArea");
    newResultArea.textContent = state.decisionMessage;
  } else {
    // unlock choices only after page 1 is marked as read
    const choiceRow = dateLeemBtn?.closest(".choice-row");
    if (!state.markedRead) {
      if (choiceRow) choiceRow.style.display = "none";
      if (readLockNote) readLockNote.style.display = "block";
      dateLeemBtn.disabled = true;
      noDateLeemBtn.disabled = true;
    } else {
      if (choiceRow) choiceRow.style.display = "flex";
      if (readLockNote) readLockNote.style.display = "none";
      dateLeemBtn.disabled = false;
      noDateLeemBtn.disabled = false;
    }
  }
}

function setStatus(text) {
  if (!statusText) return;
  statusText.textContent = text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFlipAnimation(withCover = false) {
  if (isFlipping) return;
  isFlipping = true;

  if (withCover) {
    book.classList.add("opening");
  }
  book.classList.remove("flipping");
  void book.offsetWidth;
  book.classList.add("flipping");
  applyStateToUI();

  await sleep(FLIP_MS);

  if (withCover) {
    book.classList.remove("opening");
  }
  book.classList.remove("flipping");
  isFlipping = false;
  applyStateToUI();
}

/* =========================
   localStorage
   ========================= */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* =========================
   EmailJS
   ========================= */
function initEmailJS() {
  // If user hasn't configured keys yet, don't crash.
  if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY.includes("YOUR_")) return;
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

async function notifyEmail({ subject, message, page }) {
  // If not configured, just show status and skip.
  if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY.includes("YOUR_")) {
    setStatus("EmailJS not configured (skipped)");
    return;
  }

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: RECIPIENT_EMAIL,
      subject,
      message,
      page
    });
  } catch (err) {
    console.error(err);
    setStatus("Email failed (check console)");
  }
}
