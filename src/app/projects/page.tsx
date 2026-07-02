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
          <path
            d="M -40 480 C 80 460, 160 520, 240 480 C 320 440, 360 560, 460 520
               C 560 480, 600 600, 720 580 C 840 560, 880 700, 980 660
               C 1040 640, 1060 720, 1060 780 C 1060 840, 1100 880, 1160 880
               C 1220 880, 1260 840, 1260 780 C 1260 740, 1240 720, 1200 700
               C 1200 700, 1200 620, 1200 580 C 1200 540, 1260 520, 1320 500
               C 1380 480, 1440 460, 1480 440"
            fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path d="M 1100 780 C 1100 700, 1160 660, 1220 660 C 1280 660, 1340 700, 1340 780"
            fill="none" stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
            strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="1100" cy="795" r="18" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
          <circle cx="1340" cy="795" r="18" fill="none"
            stroke={isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} strokeWidth="1.5" />
        </svg>
      </div>

      <div className="relative z-20">
        <Navbar accentColor="#00B7FF" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">

        {/* Heading */}
        <div
          className="text-center mb-12"
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
              width: 48px;
              height: 48px;
              border-radius: 50%;
              top: 50%;
              transform: translateY(-50%);
            }
            .swiper-button-prev {
              left: 40px;
            }
            .swiper-button-next {
              right: 40px;
            }
            .swiper-button-prev::after,
            .swiper-button-next::after {
              font-size: 16px;
              font-weight: bold;
            }
            .swiper-button-disabled {
              opacity: 0 !important;
              pointer-events: none !important;
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
            pagination={{ clickable: true }}
            speed={550}
            onSlideChange={(swiper) => setCurrent(swiper.activeIndex)}
            style={{ paddingBottom: 48, overflow: "visible" }}
          >
            {CARDS.map((c, i) => (
              <SwiperSlide key={c.id} style={{ width: 420 }}>
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

      </div>
    </div>
  );
}