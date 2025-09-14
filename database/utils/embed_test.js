import fs from "fs";
import pako from "pako";
import { embed } from "./slug.js";



function compressFileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const compressed = pako.deflate(fileBuffer);
  const base64 = Buffer.from(compressed).toString("base64");
  return {
    base64: base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    mimeType: "application/octet-stream" // optional: detect via mime-types package
  };
}


function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}






async function test() {
  const text = Array.from({ length: 3 }, () => generateRandomString(1024));
  const audio = [
    compressFileToBase64("../samples/city.m4a"),
    compressFileToBase64("../samples/city.m4a")
  ];
  const video = [
    compressFileToBase64("../samples/blood.mp4"),
    compressFileToBase64("../samples/blood.mp4")
  ];
  const image = [
    compressFileToBase64("../samples/penguin.jpg"),
    compressFileToBase64("../samples/penguin.jpg")
  ];

  const input = {
    "text 0": text[0],
    "text 1": text[1],
    "text 2": text[2],
    "audio 0": audio[0],
    "audio 1": audio[1],
    "video 0": video[0],
    "video 1": video[1],
    "image 0": image[0],
    "image 1": image[1],
  };

  const requirements = [
    { name: "text", type: "text", list: "yes", amount: "any", important: "yes" },
    { name: "audio", type: "audio", list: "yes", amount: "any", important: "yes" },
    { name: "video", type: "video", list: "yes", amount: "any", important: "yes" },
    { name: "image", type: "image", list: "yes", amount: "any", important: "yes" }
  ];



  console.log("Sending to embed API...");
  const embeddings = await embed(input, requirements, 1024, test = true);
  console.log(embeddings);
}


test().catch(e => console.log(e))
