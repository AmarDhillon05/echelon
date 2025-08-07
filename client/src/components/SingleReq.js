import React from "react";
import EmbeddedLink from "./EmbeddedLink.js";
import { decompressToBase64 } from "../utils/slug";
import "../styles/htmlContent.css"

export default function SingleReq({ idx, dtype, k, v }) {
  return (
    <div key={idx} className="flex flex-col gap-2">
      {/* Caption always shown */}
      <span className="text-sm text-gray-400">{k}</span>

      {dtype === "text" && (() => {
        const isHTML = typeof v === "string" && /<\/?[a-z][\s\S]*>/i.test(v);
        if (isHTML) {
          return (
            <div
              className="text-sm text-white break-words html-content"
              dangerouslySetInnerHTML={{ __html: v }}
            />
          );
        } else {
          return <div className="text-sm text-white break-words">{v}</div>;
        }
      })()}



      {dtype === "link" && <EmbeddedLink k={k} v={v} />}

      {dtype === "image" && (
        <img
          src={decompressToBase64(v)}
          alt={k || ""}
          className="w-full h-auto max-h-[80vh] object-contain rounded"
        />
      )}

      {dtype === "audio" && (
        <audio controls className="w-full">
          <source src={decompressToBase64(v)} type="audio/mpeg" />
        </audio>
      )}

      {dtype === "video" && (
        <video
          controls
          className="w-full h-auto max-h-[80vh] object-contain rounded"
        >
          <source src={decompressToBase64(v)} type="video/mp4" />
        </video>
      )}




    


    </div>
  );
}
