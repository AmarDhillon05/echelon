import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import pako from "pako";


const embed_url = process.env.EMBED_API


// For sending to api
function removeDataUriPrefix(b64String) {
  if (b64String.startsWith("data:")) {
    return b64String.split(",")[1];
  }
  return b64String;
}


//In order to allow titles as "sluggified" (required for dbs)
export function encodeString(str) {
  const compressed = pako.deflate(str);
  const base64 = btoa(String.fromCharCode(...compressed));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
  


  
export function decodeString(encoded) {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';

  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const decompressed = pako.inflate(bytes, { to: 'string' });

  return decompressed;
}




  //For files, since the input is compress base-64 (what we get and send back to the frontend)
  //We only need the reversal beacuse that 
export function decompressToBase64(base64, mimeType = 'application/octet-stream') {
    // Restore standard base64
    if(base64.base64){
      base64 = base64.base64
    }
    let paddedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (paddedBase64.length % 4 !== 0) {
      paddedBase64 += '=';
    }

    // Convert base64 to Uint8Array
    const compressedBytes = base64ToUint8Array(paddedBase64);

    // Decompress using pako (inflate)
    const decompressedBytes = pako.inflate(compressedBytes);

    // Convert back to base64 for data URI
    const decompressedBase64 = uint8ArrayToBase64(decompressedBytes);

    return `data:${mimeType};base64,${decompressedBase64}`;
  }



export function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }


export function uint8ArrayToBase64(uint8Array) {
    // Avoids call stack limits by processing in chunks
    let binary = '';
    const len = uint8Array.length;
    const chunkSize = 0x8000;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        uint8Array.subarray(i, i + chunkSize)
      );
    }
    return btoa(binary);
  }



//For links meant to be embedded - guesses the link type
async function fetchAndClassify(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer", // so we can base64-encode
      validateStatus: () => true // avoid throwing on non-2xx status codes
    });

    const contentType = res.headers["content-type"] || "";

    if (res.status !== 200 || contentType.includes("text/html")) {
      return { data: url, type: "link" }; // likely a webpage or error
    }

    const base64 = Buffer.from(res.data).toString("base64");

    if (contentType.startsWith("image/")) {
      return { data: base64, type: "image" };
    } else if (contentType.startsWith("video/")) {
      return { data: base64, type: "video" };
    } else if (contentType.startsWith("audio/")) {
      return { data: base64, type: "audio" };
    } else {
      return { data: url, type: "link" }; // fallback
    }
  } catch (err) {
    console.error("Error fetching:", err.message);
    return { data: url, type: "link" }; // fallback on error
  }
}
      


// Calling embed API
export async function embed(input, requirements, size = 1024) {
  let json_body = [];

  for (let req of requirements.filter(x => x.important === 'yes')) {
    let required_keys = [req.name];

    if (req.list === 'yes') {
      if (req.amount === 'any') {
        required_keys = [`${req.name} 0`];
      } else {
        required_keys = [];
        for (let i = 0; i < parseInt(req.amount); i++) {
          required_keys.push(`${req.name} ${i}`);
        }
      }
    }

   for(const r of required_keys){
      let dataRaw = input[r];

      // Only decompress if it's a file
      if (req.type !== "link" && req.type !== "text") {
        try {
          dataRaw = decompressToBase64(dataRaw);
        } catch (e) {
          console.error(`Failed to decompress input for ${r}:`, e);
          dataRaw = '';  // fallback or skip
        }
      }

      //Attempting to download dataRaw if it's a link
      let type = req.type
      if (type == 'link'){
        let result = await fetchAndClassify(dataRaw);
        dataRaw = result.data;
        type = result.type;

      }

      let data = {
        data: removeDataUriPrefix(dataRaw),
        type,
      };

      json_body.push(data);
    }
  }

  const request = await axios.post(`${embed_url}/embed_mult`, { data: json_body });
  return request.data.embeddings;
}



// Fail-case dummy embed
export function dummyEmbed() {
  const embedding = [];
  for (let i = 0; i < 1024; i++) {
    embedding.push(Math.random() * 2 - 1); // random float in [-1, 1]
  }
  return embedding;
}

