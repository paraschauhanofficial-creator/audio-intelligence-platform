"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import AudioBackground from "@/components/AudioBackground";
import Navbar from "@/components/Navbar";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";
import "swiper/css/pagination";

const CARDS = [
  {
    id: "ai",
    title: "You Handle It",
    subtitle: "AI Automated",
    description: "Upload stems or a mix and let AI create a polished mix and master for you. Zero manual effort.",
    color: "#00B7FF",
    href: "/projects/create/ai",
    active: true,
  },
  {
    id: "producer",
    title: "Take Control",
    subtitle: "AI + DAW",
    description: "Start with an AI-generated mix and customize every aspect of the production in the built-in DAW.",
    color: "#14D8C4",
    href: "/projects/create/producer",
    active: true,
  },
  {
    id: "instruments",
    title: "Generate Instruments",
    subtitle: "Coming Soon",
    description: "Create AI-generated acoustic instrument melodies — piano, guitar, tabla and more — that fit perfectly in your track.",
    color: "#A78BFA",
    href: null,
    active: false,
  },
];

export default function ProjectsPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * -20;
      const y = (e.clientY / window.innerHeight - 0.5) * -14;
      setParallax({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const textColor = isDarkMode ? "white" : "#1A1714";
  const mutedColor = isDarkMode ? "#a1a1aa" : "#6B6560";
  const card = CARDS[current];

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ backgroundColor: "var(--background)", color: "var(--text)" }}
    >
      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />

      {/* Scribble SVG layer */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          transform: `translate(${parallax.x * 1.8}px, ${parallax.y * 1.8}px)`,
          transition: "transform 0.18s ease-out",
          willChange: "transform",
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">

          {/* ── FLOWING LINES ── */}
          <path d="M -40 480 C 80 460, 160 520, 240 480 C 320 440, 360 560, 460 520 C 560 480, 600 600, 720 580 C 840 560, 880 700, 980 660 C 1040 640, 1060 720, 1060 780 C 1060 840, 1100 880, 1160 880 C 1220 880, 1260 840, 1260 780 C 1260 740, 1240 720, 1200 700 C 1200 700, 1200 620, 1200 580 C 1200 540, 1260 520, 1320 500 C 1380 480, 1440 460, 1480 440"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M -40 180 C 100 160, 200 220, 320 180 C 440 140, 480 240, 600 200 C 720 160, 780 260, 900 220 C 980 200, 1020 160, 1100 140 C 1180 120, 1280 160, 1440 120"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M -40 720 C 120 700, 200 760, 340 720 C 480 680, 520 780, 660 740 C 800 700, 860 800, 1000 760 C 1080 740, 1120 800, 1200 820 C 1300 840, 1380 800, 1480 820"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

          {/* ── HEADPHONES (bottom right) ── */}
          <path d="M 1100 780 C 1100 700, 1160 660, 1220 660 C 1280 660, 1340 700, 1340 780"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="1100" cy="795" r="18" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"} strokeWidth="1.5" />
          <circle cx="1340" cy="795" r="18" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"} strokeWidth="1.5" />

          {/* ── GUITAR (top left) ── */}
          <ellipse cx="120" cy="200" rx="38" ry="48" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <ellipse cx="120" cy="260" rx="30" ry="36" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <circle cx="120" cy="230" r="12" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <line x1="120" y1="152" x2="120" y2="60" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 108 60 C 104 40, 108 30, 120 28 C 132 30, 136 40, 132 60" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />
          {[112,116,120,124,128,132].map((x,i) => <line key={i} x1={x} y1="60" x2={x} y2="290" stroke={isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="0.8" />)}

          {/* ── PIANO KEYS (bottom left) ── */}
          {[0,1,2,3,4,5,6].map(i => <rect key={i} x={40+i*28} y={780} width="24" height="80" rx="3" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />)}
          {[0,1,3,4,5].map(i => <rect key={i} x={57+i*28} y={780} width="14" height="50" rx="2" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />)}

          {/* ── MICROPHONE (top right) ── */}
          <path d="M 1340 80 C 1340 40, 1400 40, 1400 80 L 1400 140 C 1400 180, 1340 180, 1340 140 Z" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {[100,120,140].map((y,i) => <line key={i} x1="1340" y1={y} x2="1400" y2={y} stroke={isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"} strokeWidth="1" />)}
          <line x1="1370" y1="180" x2="1370" y2="240" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 1340 240 C 1340 260, 1400 260, 1400 240" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />

          {/* ── MUSICAL NOTE (center top) ── */}
          <path d="M 700 80 L 700 130 M 700 80 L 730 72 L 730 122 M 700 130 C 700 140, 688 148, 688 140 C 688 132, 700 130, 700 130 M 730 122 C 730 132, 718 140, 718 132 C 718 124, 730 122, 730 122"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* ── WAVEFORM (center mid) ── */}
          <path d="M 580 450 L 600 450 L 610 420 L 620 480 L 630 430 L 640 470 L 650 440 L 660 460 L 670 450 L 690 450"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* ── TABLA (right middle) ── */}
          <ellipse cx="1100" cy="560" rx="28" ry="12" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <path d="M 1072 560 L 1068 620 C 1068 636, 1128 636, 1128 620 L 1128 560" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />
          <ellipse cx="1020" cy="565" rx="36" ry="14" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <path d="M 984 565 L 978 630 C 978 648, 1056 648, 1056 630 L 1056 565" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />

          {/* ── SITAR (left middle) ── */}
          {/* Body — large gourd */}
          <ellipse cx="220" cy="560" rx="45" ry="55" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {/* Small gourd at top */}
          <ellipse cx="220" cy="490" rx="22" ry="26" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {/* Neck */}
          <line x1="220" y1="464" x2="220" y2="360" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="2" strokeLinecap="round" />
          {/* Headstock */}
          <path d="M 208 360 C 204 340, 210 328, 220 326 C 230 328, 236 340, 232 360" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />
          {/* Frets */}
          {[380,400,420,440].map((y,i) => <line key={i} x1="208" y1={y} x2="232" y2={y} stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" />)}
          {/* Strings */}
          {[215,218,220,222,225].map((x,i) => <line key={i} x1={x} y1="360" x2={x} y2="600" stroke={isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="0.8" />)}

          {/* ── HARMONIUM (bottom center) ── */}
          {/* Body box */}
          <rect x="560" y="800" width="200" height="70" rx="6" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {/* Keys */}
          {[0,1,2,3,4,5,6,7].map(i => <rect key={i} x={568+i*22} y={810} width="18" height="40" rx="2" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" />)}
          {/* Black keys */}
          {[0,1,3,4,5].map(i => <rect key={i} x={578+i*22} y={810} width="10" height="26" rx="1" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" />)}
          {/* Bellows lines */}
          {[0,1,2,3,4].map(i => <line key={i} x1="560" y1={815+i*10} x2="760" y2={815+i*10} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="0.8" />)}

          {/* ── VIOLIN / SARANGI (top center-left) ── */}
          {/* Body */}
          <path d="M 420 80 C 400 80, 388 96, 390 116 C 392 132, 404 136, 404 148 C 404 160, 390 164, 390 180 C 390 200, 404 216, 420 216 C 436 216, 450 200, 450 180 C 450 164, 436 160, 436 148 C 436 136, 448 132, 450 116 C 452 96, 440 80, 420 80 Z"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {/* F holes */}
          <path d="M 410 130 C 410 124, 414 120, 414 128" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" strokeLinecap="round" />
          <path d="M 430 130 C 430 124, 426 120, 426 128" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" strokeLinecap="round" />
          {/* Neck */}
          <line x1="420" y1="80" x2="420" y2="36" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="2" strokeLinecap="round" />
          {/* Scroll */}
          <path d="M 414 36 C 410 28, 416 20, 424 22 C 430 24, 432 32, 426 36" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />
          {/* Bow */}
          <path d="M 456 60 C 480 80, 480 180, 456 200" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" strokeLinecap="round" />
          <line x1="456" y1="60" x2="456" y2="200" stroke={isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="0.8" />

          {/* ── BANSURI / FLUTE (top center-right) ── */}
          <line x1="820" y1="40" x2="1060" y2="80" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="2" strokeLinecap="round" />
          {/* Finger holes */}
          {[0,1,2,3,4,5].map(i => <circle key={i} cx={860+i*32} cy={47+i*6} r="4" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.2" />)}
          {/* Embouchure hole */}
          <ellipse cx="836" cy="43" rx="6" ry="4" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.2" />

          {/* ── DRUM KIT SNARE (right upper) ── */}
          <ellipse cx="1260" cy="340" rx="50" ry="16" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <path d="M 1210 340 L 1208 380 C 1208 392, 1312 392, 1312 380 L 1310 340" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" strokeLinecap="round" />
          {/* Snare wires */}
          {[0,1,2].map(i => <line key={i} x1={1228+i*16} y1="380" x2={1228+i*16} y2="392" stroke={isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"} strokeWidth="0.8" />)}
          {/* Drumsticks */}
          <line x1="1230" y1="300" x2="1260" y2="340" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="1290" y1="300" x2="1260" y2="340" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" strokeLinecap="round" />

          {/* ── TANPURA (right lower) ── */}
          {/* Large gourd body */}
          <ellipse cx="1380" cy="620" rx="40" ry="50" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {/* Small gourd */}
          <ellipse cx="1380" cy="554" rx="20" ry="24" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {/* Long neck */}
          <line x1="1380" y1="530" x2="1380" y2="400" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="2" strokeLinecap="round" />
          {/* Strings — 4 strings */}
          {[1375,1378,1382,1385].map((x,i) => <line key={i} x1={x} y1="400" x2={x} y2="660" stroke={isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeWidth="0.8" />)}

          {/* ── SPEAKER / MONITOR (left lower) ── */}
          <rect x="40" y="680" width="80" height="80" rx="8" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          {/* Woofer */}
          <circle cx="80" cy="720" r="24" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <circle cx="80" cy="720" r="14" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" />
          <circle cx="80" cy="720" r="6" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" />
          {/* Tweeter */}
          <circle cx="80" cy="692" r="6" fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" />

          {/* ── EQUALIZER BARS (center lower) ── */}
          {[0,1,2,3,4,5,6,7,8,9].map(i => {
            const heights = [30,50,40,70,55,45,65,35,60,48];
            return <rect key={i} x={640+i*18} y={760-heights[i]} width="12" height={heights[i]} rx="3" fill="none"
              stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1" />;
          })}

          {/* ── DOUBLE BASS CLEF (far left center) ── */}
          <path d="M 30 420 C 30 400, 50 390, 60 410 C 70 430, 50 450, 30 440 C 20 435, 20 445, 30 450 C 50 460, 70 450, 68 430"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="72" cy="415" r="3" fill={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} />
          <circle cx="72" cy="428" r="3" fill={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} />

        </svg>
      </div>

      <div className="relative z-20">
        <Navbar accentColor="#00B7FF" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] pb-16" style={{ marginTop: "-40px" }}>

        {/* Heading */}
        <div
          className="text-center mb-8 px-4"
          style={{
            transform: `translate(${parallax.x * 0.3}px, ${parallax.y * 0.3}px)`,
            transition: "transform 0.2s ease-out",
          }}
        >
          <h2 className="text-3xl font-bold mb-2" style={{ color: textColor }}>
            Welcome Back
          </h2>
          <p className="text-sm" style={{ color: mutedColor }}>
            Choose how you want to create today.
          </p>
        </div>

        {/* Swiper carousel */}
        <div className="w-full relative">
          <style>{`
            .swiper-button-prev,
            .swiper-button-next {
              color: ${mutedColor};
              background: ${isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"};
              border: 1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};
              width: 32px;
              height: 32px;
              border-radius: 50%;
              top: 50%;
              transform: translateY(-50%);
            }
            .swiper-button-prev {
              left: 8px;
            }
            .swiper-button-next {
              right: 8px;
            }
            .swiper-button-prev::after,
            .swiper-button-next::after {
              font-size: 11px;
              font-weight: bold;
            }
            .swiper-button-disabled {
              opacity: 0 !important;
              pointer-events: none !important;
            }
            .swiper-pagination {
              position: fixed !important;
              bottom: 32px !important;
              left: 50% !important;
              transform: translateX(-50%) !important;
              width: auto !important;
            }
            .swiper-pagination-bullet {
              background: ${isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"};
              opacity: 1;
            }
            .swiper-pagination-bullet-active {
              background: ${CARDS[current].color};
              width: 24px;
              border-radius: 3px;
            }
          `}</style>

          <Swiper
            modules={[EffectCoverflow, Navigation, Pagination]}
            effect="coverflow"
            grabCursor={true}
            centeredSlides={true}
            slidesPerView="auto"
            loop={false}
            coverflowEffect={{
              rotate: 0,
              stretch: 0,
              depth: 80,
              modifier: 2.5,
              slideShadows: false,
            }}
            navigation={true}
            pagination={false}
            speed={550}
            onSlideChange={(swiper) => setCurrent(swiper.activeIndex)}
            style={{ overflow: "visible" }}
          >
            {CARDS.map((c, i) => (
              <SwiperSlide key={c.id} style={{ width: "min(420px, 75vw)" }}>
                {({ isActive }: { isActive: boolean }) => (
                  <div
                    className="rounded-2xl p-8 cursor-pointer select-none"
                    style={{
                      height: 320,
                      backgroundColor: isDarkMode
                        ? "rgba(17,24,39,0.85)"
                        : "rgba(234,228,216,0.90)",
                      border: `1px solid ${isActive
                        ? c.color + "60"
                        : isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                      backdropFilter: "blur(12px)",
                      boxShadow: isActive
                        ? `0 0 40px ${c.color}20, 0 20px 60px rgba(0,0,0,0.3)`
                        : "0 8px 32px rgba(0,0,0,0.15)",
                      transition: "border 0.3s ease, box-shadow 0.3s ease",
                    }}
                    onClick={() => {
                      if (isActive && c.href) router.push(c.href);
                    }}
                  >
                    <div className="w-8 h-[2px] rounded-full mb-5"
                      style={{ backgroundColor: c.color }} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2"
                      style={{ color: c.color }}>
                      {c.subtitle}
                    </p>
                    <h3 className="text-2xl font-bold mb-4"
                      style={{ color: isActive ? c.color : textColor }}>
                      {c.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: mutedColor }}>
                      {c.description}
                    </p>
                    {isActive && c.active && (
                      <div className="mt-6">
                        <span className="text-xs font-semibold px-3 py-1 rounded-full"
                          style={{
                            backgroundColor: c.color + "20",
                            color: c.color,
                            border: `1px solid ${c.color}40`,
                          }}>
                          Get Started →
                        </span>
                      </div>
                    )}
                    {isActive && !c.active && (
                      <div className="mt-6">
                        <span className="text-xs font-semibold px-3 py-1 rounded-full"
                          style={{
                            backgroundColor: "rgba(128,128,128,0.15)",
                            color: mutedColor,
                            border: "1px solid rgba(128,128,128,0.2)",
                          }}>
                          Coming Soon
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* Dots — fixed at bottom of screen */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
          {CARDS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 24 : 6,
                height: 6,
                backgroundColor: i === current
                  ? CARDS[current].color
                  : isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
              }}
            />
          ))}
        </div>

      </div>
    </div>
  );
}