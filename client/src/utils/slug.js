import pako from 'pako'


//These are for sluggificaiton

export function decompressToBase64(base64, mimeType = 'application/octet-stream') {
    if(base64.base64){
      base64 = base64.base64
    }
    // Restore standard base64
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
     