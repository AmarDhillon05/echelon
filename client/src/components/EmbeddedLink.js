import React from "react";

//For if we're given a link but we wanna consider embedding it into the webpage

export default function EmbeddedLink({ k, v }) {
  const url = v?.toLowerCase() || "";


  // RENDER IMAGE
  if (url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || url.startsWith("data:image")) {
    return <img src={v} alt={k} className="max-w-full max-h-64 rounded shadow" onClick={(e) => e.stopPropagation()} />;
  }

  // EMBEDDED YOUTUBE VIDEO
  if (url.includes("youtube") && url.includes("embed")) {
    return (
      <iframe
        src={v}
        className="w-full h-auto max-h-[80vh] object-contain aspect-video rounded shadow"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        webkitallowfullscreen="true"
        mozallowfullscreen="true"
        title={k}
        onClick={(e) => e.stopPropagation()}
      />

    );
  }

  // RENDER VIDEO
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    return (
      <video controls className="w-full h-auto max-h-[80vh] object-contain rounded shadow" onClick={(e) => e.stopPropagation()}>
        <source src={v} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  }

  // RENDER AUDIO
  if (url.match(/\.(mp3|wav|ogg)$/i)) {
    return (
      <audio controls className="w-full mt-2" onClick={(e) => e.stopPropagation()}>
        <source src={v} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    );
  }

  // FALLBACK: LINK
  return (
    <a
      className="text-purple-400 underline text-sm"
      href={v}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {k}
    </a>
  );
}
