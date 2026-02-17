const API_KEY = "T6cddaelRSPTKEuhmHzZvTqhG8ZB4bYsH6BfmsLO"; // replace with your GovInfo API key
const NUM_DOCS = 5; // PDFs per search
const POSTS_PER_DROP = 10; // sentences per feed

async function fetchDocs() {
  const query = document.getElementById("searchQuery").value || "declassified";
  const year = document.getElementById("yearFilter").value;
  const agency = document.getElementById("agencyFilter").value;

  const feed = document.getElementById("feed");
  feed.innerHTML = "Loading...";

  let searchQuery = query;
  if (year) searchQuery += ` ${year}`;
  if (agency) searchQuery += ` ${agency}`;

  const url = `https://api.govinfo.gov/search?query=${encodeURIComponent(searchQuery)}&offset=0&pageSize=${NUM_DOCS}&api_key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    feed.innerHTML = "";
    let allSentences = [];

    for (const pkg of data.packages) {
      const pdfUrl = await getPdfUrl(pkg.packageId);
      let textContent = "";
      if (pdfUrl) textContent = await parsePdf(pdfUrl);
      const scoredSentences = scoreSentences(textContent || pkg.summary || pkg.title, pkg.packageId);
      allSentences = allSentences.concat(scoredSentences);
    }

    // Randomized drop
    allSentences.sort(() => Math.random() - 0.5);
    const randomFeed = allSentences.slice(0, POSTS_PER_DROP);

    randomFeed.forEach(s => renderPost(s.text, s.date, s.collection, s.packageId, s.score));

  } catch (error) {
    feed.innerHTML = "Error loading data.";
    console.error(error);
  }
}

async function getPdfUrl(packageId) {
  try {
    const response = await fetch(`https://api.govinfo.gov/packages/${packageId}/formats?api_key=${API_KEY}`);
    const data = await response.json();
    const pdf = data.formats.find(f => f.format === "pdf");
    return pdf?.url || null;
  } catch {
    return null;
  }
}

async function parsePdf(url) {
  const loadingTask = pdfjsLib.getDocument(url);
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(" ") + " ";
  }

  return fullText;
}

function scoreSentences(text, packageId) {
  const keywords = ["classified","covert","experiment","surveillance","nuclear","biological","intelligence","operation","anomaly","recovered"];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

  return sentences.map(sentence => {
    let score = 0;
    keywords.forEach(word => {
      if (sentence.toLowerCase().includes(word)) score += 5;
    });
    if (/\d{4}/.test(sentence)) score += 2;
    if (sentence.length > 120) score += 1;

    return { text: sentence.trim().substring(0, 280), score, packageId };
  });
}

function renderPost(text, date, collection, packageId, score) {
  const feed = document.getElementById("feed");
  const div = document.createElement("div");
  div.className = "post";

  const shockLevel = Math.min(5, Math.ceil(score / 5));
  const fireIcons = "🔥".repeat(shockLevel);

  const glitchOffset = () => (Math.random() * 4 - 2) + "px";

  div.innerHTML = `
    <div style="position:relative; left:${glitchOffset()}; top:${glitchOffset()};">${text}</div>
    <div class="meta">
      ${fireIcons} 📅 ${date || "Unknown"} | 📁 ${collection || "N/A"} 
      <br>
      <a href="https://www.govinfo.gov/app/details/${packageId}" target="_blank" style="color:#f0f">${fireIcons}</a>
    </div>
  `;

  feed.appendChild(div);
}
