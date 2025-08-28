const express = require("express");
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

// ==== FUNGSI DOWNLOAD FOTO ====
async function downloadFoto(url, outputPath) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

// ==== FUNGSI FOTO → VIDEO ====
function fotoKeVideo(inputFoto, outputVideo, durasiDetik = 10) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputFoto)
      .loop(durasiDetik)
      .outputOptions(["-c:v libx264", `-t ${durasiDetik}`, "-pix_fmt yuv420p", "-vf scale=720:-1", "-preset ultrafast", "-crf 30"])
      .save(outputVideo)
      .on("end", () => resolve(outputVideo))
      .on("error", (err) => reject(err));
  });
}

// ==== FUNGSI UPLOAD TIKTOK (Playwright) ====
async function uploadTikTok(videoPath) {
  const browser = await chromium.launch({
    headless: true,
    channel: "chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-accelerated-2d-canvas", "--no-zygote", "--disable-gpu", "--single-process"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("➡️ Buka halaman TikTok...");
  await page.goto("https://www.tiktok.com/upload?lang=id-ID", {
    waitUntil: "domcontentloaded",
  });

  // Tunggu input file
  const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 20000 });

  // Upload video
  await fileInput.setInputFiles(videoPath);
  console.log("🎥 Video diupload ke TikTok (draft).");

  // Tunggu caption box
  const captionBox = await page.waitForSelector('div[contenteditable="true"]', { timeout: 20000 });
  await captionBox.type("Upload otomatis via Playwright 🚀");

  // Klik tombol Post
  const postButton = await page.waitForSelector("button:has-text('Post')", { timeout: 20000 });
  await postButton.click();

  console.log("✅ Video berhasil diposting ke TikTok.");
  await browser.close();
}

// ==== ROUTES EXPRESS ====
app.get("/", (req, res) => {
  res.send("🚀 Service TikTok via Playwright siap digunakan");
});

app.get("/generate", async (req, res) => {
  try {
    const durasi = parseInt(req.query.durasi) || 10;
    const fotoUrl = `https://farhan.tripointeknologi.com/proses/output/quote.png?ts=${Date.now()}`;
    const inputFoto = path.join(__dirname, "quotes.png");
    const outputVideo = path.join(__dirname, "video.mp4");

    console.log("⬇️ Download foto...");
    await downloadFoto(fotoUrl, inputFoto);

    console.log(`🎞️ Convert foto → video (${durasi}s)...`);
    await fotoKeVideo(inputFoto, outputVideo, durasi);

    res.send(`✅ Video berhasil dibuat (${durasi}s)`);
  } catch (err) {
    console.error("❌ Error generate:", err);
    res.status(500).send("Gagal generate video");
  }
});

app.get("/upload", async (req, res) => {
  try {
    const outputVideo = path.join(__dirname, "video.mp4");

    if (!fs.existsSync(outputVideo)) {
      return res.status(400).send("❌ Video belum ada. Jalankan /generate dulu.");
    }

    await uploadTikTok(outputVideo);
    res.send("✅ Video berhasil diupload ke TikTok");
  } catch (err) {
    console.error("❌ Error upload:", err);
    res.status(500).send("Gagal upload ke TikTok");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di port ${PORT}`);
});
