// ==============================
// 🔐 GOVINFO CONFIG
// ==============================
const API_KEY = "T6cddaelRSPTKEuhmHzZvTqhG8ZB4bYsH6BfmsLO"; 
const BASE_URL = "https://api.govinfo.gov";

// ==============================
// 🐱 AZUL DYNAMIC PULSE SYSTEM
// ==============================
let azulState = false;
let azulSpeed = 800;
let azulInterval;
let maxShock = 0;

function startAzulPulse() {
  const azul = document.getElementById("azul");
  if (!azul) return;

  clearInterval(azulInterval);

  azulInterval = setInterval(() => {
    azulState = !azulState;
    azul.src = azulState ? "azul-cat2.png" : "azul-cat.png";

    // Calm down slowly
    if (azulSpeed < 800 && maxShock <= 1) {
      azulSpeed += 20;
      startAzulPulse();
    }
  }, azulSpeed);
}

function updateAzulPulseBasedOnShock(shockLevel) {
  maxShock = Math.max(maxShock, shockLevel);

  const speedMap = [800, 600, 400, 250, 150, 100];
  azulSpeed = speedMap[shockLevel] || 800;

  startAzulPulse();

  setTimeout(() => {
    maxShock = Math.max(0, maxShock - 1);
  }, 4000);
}

startAzulPulse();

// ==============================
// 🔎 SEARCH STATE
// ==============================
let nextPageToken = null;
let isLoading = false;

// ==============================
// 🔍 FETCH DOCUMENTS (POST)
// ==============================
async function fetchDocs(loadMore = false) {
  if (isLoading) return;
  isLoading = true;

  const query = document.getElementById("searchQuery").value.trim();
  const year = document.getElementById("yearFilter").value.trim();
  const agency = document.getElementById("agencyFilter").value;

  if (!loadMore) {
    document.getElementById("feed").innerHTML = "";
    nextPageToken = null;
  }

  const searchQuery = {
    query: query || "nuclear",
    pageSize: 10,
    pageToken: nextPageToken || undefined,
    facets: [],
    filters: {}
  };

  if (year) {
    searchQuery.filters.dateIssued = `${year}-01-01:${year}-12-31`;
  }

  if (agency) {
    searchQuery.filters.collection = agency;
  }

  try {
    const response = await fetch(`${BASE_URL}/search?api_key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchQuery)
    });

    const data = await response.json();

    if (!data.packages || data.packages.length === 0) {
      isLoading = false;
      return;
    }

    nextPageToken = data.nextPageToken || null;

    await processPackagesProgressively(data.packages);

  } catch (error) {
    console.error("Search error:", error);
  }

  isLoading = false;
}

// ==============================
// 📦 PROCESS PACKAGES (3 at a time)
// ==============================
async function processPackagesProgressively(results) {
  const feed = document.getElementById("feed");

  let status = document.createElement("div");
  status.innerText = `Processing ${results.length} results...`;
  feed.appendChild(status);

  for (let i = 0; i < results.length; i++) {
    const pkg = results[i];

    // POST BASIC RESULT IMMEDIATELY (so you see something)
    renderPost(
      pkg.title || "Untitled Document",
      pkg.dateIssued,
      pkg.collectionCode,
      pkg.packageId,
      1
    );

    // OPTIONAL: try fetching PDF summary
    try {
      const summaryRes = await fetch(
        `${BASE_URL}/packages/${pkg.packageId}/summary?api_key=${API_KEY}`
      );

      const summaryData = await summaryRes.json();

      if (summaryData.download && summaryData.download.pdfLink) {
        const text = await parsePdf(summaryData.download.pdfLink);
        extractInterestingSentences(text, summaryData);
      }

    } catch (err) {
      console.log("Summary fetch error:", err);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  status.remove();
}
// ==============================
// 📄 PDF PARSER (first 10 pages)
// ==============================
async function parsePdf(url) {
  const pdf = await pdfjsLib.getDocument(url).promise;
  let fullText = "";

  const maxPages = Math.min(pdf.numPages, 10);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(" ") + " ";
  }

  return fullText;
}

// ==============================
// 🔥 SENTENCE SCORING
// ==============================
const keywords = [
  "classified", "secret", "nuclear", "covert", 
  "surveillance", "weapon", "operation", "intelligence"
];

function extractInterestingSentences(text, pkg) {
  const sentences = text.split(". ");

  sentences.forEach(sentence => {
    let score = 0;
    keywords.forEach(word => {
      if (sentence.toLowerCase().includes(word)) score += 5;
    });

    if (score > 0) {
      renderPost(sentence.trim(), pkg.dateIssued, pkg.collectionCode, pkg.packageId, score);
    }
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

  if (shockLevel > 0) {
    updateAzulPulseBasedOnShock(shockLevel);
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

// ==============================
// ♾ INFINITE SCROLL
// ==============================
window.addEventListener("scroll", () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
    if (nextPageToken && !isLoading) {
      fetchDocs(true);
    }
  }
});
