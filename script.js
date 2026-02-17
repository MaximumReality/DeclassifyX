// ==============================
// 🔑 CONFIG
// ==============================
const API_KEY = "T6cddaelRSPTKEuhmHzZvTqhG8ZB4bYsH6BfmsLO";
const PAGE_SIZE = 5;
const POSTS_PER_BATCH = 10;

// ==============================
// 🧠 STATE
// ==============================
let currentOffset = 0;
let isLoading = false;
let currentQuery = "declassified";
let seenSentences = new Set();

// ==============================
// 🐱 AZUL PULSE SYSTEM
// ==============================
let azulState = false;
let azulSpeed = 800; // normal pulse
let azulInterval;

function startAzulPulse() {
  const azul = document.getElementById("azul");
  if (!azul) return;

  clearInterval(azulInterval);

  azulInterval = setInterval(() => {
    azulState = !azulState;
    azul.src = azulState ? "azul-cat2.png" : "azul-cat.png";
  }, azulSpeed);
}

function setAzulSpeed(speed) {
  azulSpeed = speed;
  startAzulPulse();
}

window.addEventListener("load", () => {
  startAzulPulse();
});

// ==============================
// 🔎 SEARCH START
// ==============================
async function fetchDocs() {
  const query = document.getElementById("searchQuery").value || "declassified";
  const year = document.getElementById("yearFilter").value;
  const agency = document.getElementById("agencyFilter").value;

  currentOffset = 0;
  seenSentences.clear();
  document.getElementById("feed").innerHTML = "";

  currentQuery = query;
  if (year) currentQuery += ` ${year}`;
  if (agency) currentQuery += ` ${agency}`;

  await loadMore();
}

// ==============================
// ♾ INFINITE SCROLL
// ==============================
window.addEventListener("scroll", () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
    loadMore();
  }
});

// ==============================
// 📥 LOAD MORE DOCUMENTS
// ==============================
async function loadMore() {
  if (isLoading) return;
  isLoading = true;

  setAzulSpeed(200); // faster pulse while loading

  const url = `https://api.govinfo.gov/search?query=${encodeURIComponent(currentQuery)}&offset=${currentOffset}&pageSize=${PAGE_SIZE}&api_key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    currentOffset += PAGE_SIZE;

    let allSentences = [];

    for (const pkg of data.packages) {
      const pdfUrl = await getPdfUrl(pkg.packageId);
      let textContent = "";

      if (pdfUrl) {
        textContent = await parsePdf(pdfUrl);
      }

      const scored = scoreSentences(
        textContent || pkg.summary || pkg.title,
        pkg.packageId,
        pkg.dateIssued,
        pkg.collectionCode
      );

      allSentences = allSentences.concat(scored);
    }

    // Sort by shock score
    allSentences.sort((a, b) => b.score - a.score);

    let count = 0;

    for (const sentence of allSentences) {
      if (!seenSentences.has(sentence.text)) {
        seenSentences.add(sentence.text);

        renderPost(
          sentence.text,
          sentence.date,
          sentence.collection,
          sentence.packageId,
          sentence.score
        );

        count++;
      }

      if (count >= POSTS_PER_BATCH) break;
    }

  } catch (error) {
    console.error("Load error:", error);
  }

  setAzulSpeed(800); // calm pulse after loading
  isLoading = false;
}

// ==============================
// 📄 GET PDF URL
// ==============================
async function getPdfUrl(packageId) {
  try {
    const response = await fetch(
      `https://api.govinfo.gov/packages/${packageId}/formats?api_key=${API_KEY}`
    );
    const data = await response.json();
    const pdf = data.formats.find(f => f.format === "pdf");
    return pdf?.url || null;
  } catch {
    return null;
  }
}

// ==============================
// 📚 PARSE PDF (first 10 pages only)
// ==============================
async function parsePdf(url) {
  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;

  let fullText = "";

  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(" ") + " ";
  }

  return fullText;
}

// ==============================
// 🔥 SCORE SENTENCES
// ==============================
function scoreSentences(text, packageId, date, collection) {
  const keywords = [
    "classified",
    "covert",
    "experiment",
    "surveillance",
    "nuclear",
    "biological",
    "intelligence",
    "operation",
    "anomaly",
    "recovered"
  ];

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  return sentences.map(sentence => {
    let score = 0;

    keywords.forEach(word => {
      if (sentence.toLowerCase().includes(word)) score += 5;
    });

    if (/\d{4}/.test(sentence)) score += 2;
    if (sentence.length > 120) score += 1;

    return {
      text: sentence.trim().substring(0, 280),
      score,
      packageId,
      date,
      collection
    };
  });
}

// ==============================
// 📰 RENDER POST
// ==============================
function renderPost(text, date, collection, packageId, score) {
  const feed = document.getElementById("feed");
  const div = document.createElement("div");
  div.className = "post";

  const shockLevel = Math.min(5, Math.ceil(score / 5));
  const fireIcons = "🔥".repeat(shockLevel);

  // Overload reaction for max shock
  if (shockLevel >= 5) {
    setAzulSpeed(100);
    setTimeout(() => setAzulSpeed(800), 2000);
  }

  const glitchOffset = () => (Math.random() * 4 - 2) + "px";

  div.innerHTML = `
    <div style="position:relative; left:${glitchOffset()}; top:${glitchOffset()};">
      ${text}
    </div>
    <div class="meta">
      ${fireIcons} 📅 ${date || "Unknown"} | 📁 ${collection || "N/A"}
      <br>
      <a href="https://www.govinfo.gov/app/details/${packageId}" target="_blank" style="color:#f0f">
        View Source
      </a>
    </div>
  `;

  feed.appendChild(div);
}
