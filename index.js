const express = require("express");
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

// Set path ffmpeg agar tidak perlu install sistem
ffmpeg.setFfmpegPath(ffmpegPath);

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
      .outputOptions(["-c:v libx264", "-t " + durasiDetik, "-pix_fmt yuv420p"])
      .save(outputVideo)
      .on("end", () => resolve(outputVideo))
      .on("error", (err) => reject(err));
  });
}

// ==== FUNGSI UPLOAD TIKTOK ====
async function uploadTikTok(videoPath) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const cookiesPath = path.join(__dirname, "cookies.json");
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath));
    await context.addCookies(cookies);
  }

  const page = await context.newPage();
  await page.goto("https://www.tiktok.com/upload", { waitUntil: "networkidle" });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.click('input[type="file"]'), // sesuaikan selector
  ]);
  await fileChooser.setFiles(videoPath);

  console.log("Video siap di-upload ke TikTok.");
  await page.waitForTimeout(10000);

  await browser.close();
}

// ==== EXPRESS SERVER UNTUK RENDER ====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Service TikTok siap 🚀");
});

// Endpoint untuk generate video
app.get("/generate", async (req, res) => {
  try {
    const fotoUrl = `https://farhan.tripointeknologi.com/proses/output/quote.png?ts=${Date.now()}`;
    const inputFoto = path.join(__dirname, "quotes.png");
    const outputVideo = path.join(__dirname, "video.mp4");

    console.log("Download foto...");
    await downloadFoto(fotoUrl, inputFoto);

    console.log("Convert foto → video...");
    await fotoKeVideo(inputFoto, outputVideo, 10);

    res.send("Video berhasil dibuat ✅");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal generate video ❌");
  }
});

// Endpoint untuk langsung upload ke TikTok
app.get("/upload", async (req, res) => {
  try {
    const outputVideo = path.join(__dirname, "video.mp4");
    await uploadTikTok(outputVideo);
    res.send("Video berhasil diupload ke TikTok ✅");
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal upload ke TikTok ❌");
  }
});

app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});
