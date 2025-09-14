import React from "react";
import { useState, useEffect } from "react";
import SingleReq from "./SingleReq";
import ReqModal from "./ReqModal";


export default function Req({ entries, reqName, i, dtype, captions }) {
  const slides = [];
  let currentSlide = [];
  let ind = 0;

  let needsPopup = false
  const [showPopup, setShowPopup] = useState(false)

  for (const entry of entries) {
    const comp = (
      <SingleReq
        idx={ind}
        dtype={dtype}
        k={captions[ind] || reqName}
        v={entry}
        key={ind}
      />
    );

    if (
      dtype === "image" ||
      dtype === "video" ||
      (dtype === "link" &&
        ((entry.includes("youtube") && entry.includes("embed")) ||
        (entry.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || entry.startsWith("data:image"))  || 
          entry.match(/\.(mp4|webm|ogg)$/i) ||
          entry.match(/\.(mp3|wav|ogg)$/i)))
    ) {
      if (currentSlide.length > 0) slides.push(currentSlide);
      slides.push([comp]);
      currentSlide = [];
      needsPopup = true
    } else {
      currentSlide.push(comp);
    }

    ind += 1;
  }

  if (currentSlide.length > 0) slides.push(currentSlide);

  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  const prevSlide = () => {
    setFade(false);
    setTimeout(() => {
      setIdx((prev) => (prev - 1 + slides.length) % slides.length);
      setFade(true);
    }, 300);
  };

  const nextSlide = () => {
    setFade(false);
    setTimeout(() => {
      setIdx((prev) => (prev + 1) % slides.length);
      setFade(true);
    }, 300);
  };

  return (
    <div className="p-4 bg-zinc-900 rounded-2xl text-white shadow-[0_0_10px_#a855f7aa]">

      <ReqModal
      entries={entries}
      reqName={reqName}
      dtype={dtype}
      captions={captions}
      isOpen={showPopup}
      onClose={() => {
        setShowPopup(false)
      }}
      ></ReqModal>

      <h2 className="text-lg font-semibold text-purple-400 mb-4">{reqName}</h2>

      {needsPopup && <a className = "text-sm"
      onClick={(e) => {
        e.stopPropagation()
        setShowPopup(true)
      }}
      >
        {showPopup ? "" : "Expand"}
      </a>}

      <ul
        className={`flex flex-col gap-4 list-none transition-opacity duration-300 ease-in-out ${
          fade ? "opacity-100" : "opacity-0"
        }`}
      >
        {slides.length > 0 && slides[idx].map((comp, i) => (
          <li key={i}>{comp}</li>
        ))}
      </ul>

      {slides.length > 1 && (
        <div className="flex justify-center gap-4 mt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="hover:bg-purple-700 text-white w-8 h-8 flex items-center justify-center"
            aria-label="Previous slide"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="hover:bg-purple-700 text-white w-8 h-8 flex items-center justify-center"
            aria-label="Next slide"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
