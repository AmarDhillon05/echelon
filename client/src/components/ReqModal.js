import { useState } from "react";
import { createPortal } from "react-dom";
import SingleReq from "./SingleReq";

export default function ReqModal({ entries, reqName, dtype, captions, isOpen, onClose }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  if (!isOpen) return null;

  const slides = [];
  let currentSlide = [];
  let ind = 0;

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
          (entry.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || entry.startsWith("data:image")) ||
          entry.match(/\.(mp4|webm|ogg)$/i) ||
          entry.match(/\.(mp3|wav|ogg)$/i)))
    ) {
      if (currentSlide.length > 0) slides.push(currentSlide);
      slides.push([comp]);
      currentSlide = [];
    } else {
      currentSlide.push(comp);
    }

    ind += 1;
  }

  if (currentSlide.length > 0) slides.push(currentSlide);

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-zinc-900 text-white p-6 rounded-lg shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-purple-400 text-2xl font-bold"
        >
          ×
        </button>

        <h2 className="text-2xl font-semibold text-purple-400 mb-6 text-center">
          {reqName}
        </h2>

        <ul
          className={`flex flex-col gap-4 list-none transition-opacity duration-300 ease-in-out items-center ${
            fade ? "opacity-100" : "opacity-0"
          }`}
        >
          {slides.length > 0 && slides[idx].map((comp, i) => <li key={i}>{comp}</li>)}
        </ul>

        {slides.length > 1 && (
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={prevSlide}
              className="hover:bg-purple-700 text-white w-12 h-12 flex items-center justify-center rounded-full text-2xl"
            >
              ‹
            </button>
            <button
              onClick={nextSlide}
              className="hover:bg-purple-700 text-white w-12 h-12 flex items-center justify-center rounded-full text-2xl"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
