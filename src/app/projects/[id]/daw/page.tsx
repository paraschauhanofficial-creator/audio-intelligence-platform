"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DAWPage() {
  const router = useRouter();

  const [selectedTrack, setSelectedTrack] =
    useState("Vocal");

  const [inspectorView, setInspectorView] =
    useState<"main" | "sends">(
      "main"
    );





    const [mutedTracks, setMutedTracks] =
  useState<string[]>([]);

const [soloTrack, setSoloTrack] =
  useState<string | null>(null);

  const toggleMute = (
  track: string
) => {
  setMutedTracks((prev) =>
    prev.includes(track)
      ? prev.filter(
          (t) => t !== track
        )
      : [...prev, track]
  );
};


const toggleSolo = (
  track: string
) => {
  setSoloTrack((prev) =>
    prev === track
      ? null
      : track
  );
};







    const [expandedView, setExpandedView] =
  useState<
    "none" |
    "timeline" |
    "mixer"
  >("none");

    const isSendMode =
  inspectorView === "sends";

const trackColor =
  "#14D8C4";

const sendColor =
  "#FF6B4A";

const channelColor =
  isSendMode
    ? sendColor
    : trackColor;

  const saveSession = () => {
    alert("Changes Saved");
  };

  return (
    <div className="h-screen overflow-hidden bg-[#0A0A0A] text-white flex flex-col">

      {/* Header */}

      <div className="h-[72px] border-b border-[#1F2937] px-8 flex items-center">

  <div className="flex items-center justify-between w-full">

          <h1 className="text-2xl font-bold">
            Producer Workspace
          </h1>

          <div className="flex items-center gap-3">

            <button
              onClick={saveSession}
              className="
                px-4 py-2
                rounded-lg
                bg-[#14D8C4]
                text-black
                font-semibold
              "
            >
              Save
            </button>

            <button
              onClick={() => router.back()}
              className="
                px-4 py-2
                rounded-lg
                border border-[#1F2937]
              "
            >
              Back To Project
            </button>

          </div>

        </div>

      </div>

      <div className="p-4 flex-1 overflow-hidden flex flex-col">

  {/* Session Bar */}

  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 mb-4 flex-shrink-0">

            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">

  <p className="text-xs text-zinc-500">
    Project
  </p>

  <p className="text-xl font-semibold truncate">
    Coffee Test
  </p>

</div>



          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500">
              Tempo
            </p>

            <p className="text-xl font-semibold">
              --
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500">
              Key
            </p>

            <p className="text-xl font-semibold">
              --
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
            <p className="text-xs text-zinc-500">
              Signature
            </p>

            <p className="text-xl font-semibold">
              --
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">

            <p className="text-xs text-zinc-500 mb-2">
              Transport
            </p>

            <div className="flex items-center gap-4 text-lg">

              <button>⏮</button>

              <button>▶</button>

              <button>⏸</button>

              <button>⏹</button>

              <button>⏭</button>

            </div>

          </div>

        </div>

        {/* Workspace */}

        <div
  className="
    flex-1
    min-h-0
    overflow-hidden
    grid
    grid-cols-[180px_1fr_180px_80px_60px]
    gap-4
  "
>

          {/* Tracks */}

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 overflow-y-auto min-h-0">

            <h3 className="text-lg font-semibold mb-4">
              Tracks
            </h3>

            <div className="space-y-2">

              {[
                "Kick",
                "Bass",
                "Piano",
                "Vocal",
              ].map((track, index) => (

                <button
                  key={track}
                  onClick={() =>
                    setSelectedTrack(track)
                  }
                  className={`
                    w-full
                    text-left
                    px-3 py-3
                    rounded-lg
                    border
                    transition
                    ${
                      selectedTrack === track
                        ? "border-[#14D8C4] bg-[#14D8C415]"
                        : "border-[#1F2937]"
                    }
                  `}
                >
                  {index + 1}. {track}
                </button>

              ))}

            </div>

          </div>

          {/* Timeline + Mixer */}

          <div
  className="
    h-full
    flex
    flex-col
    gap-4
    overflow-hidden
  "
>

            <div
  className={`
    bg-[#111827]
    border
    border-[#1F2937]
    rounded-2xl
    p-6
    flex
    flex-col
    min-h-0
    ${
      expandedView === "timeline"
        ? "flex-1"
        : expandedView === "mixer"
        ? "hidden"
        : "h-[60%]"
    }
  `}
>

              <div className="flex items-center justify-between mb-4">

                <h3 className="text-lg font-semibold">
                  Timeline
                </h3>

                <button
  onClick={() =>
    setExpandedView(
      expandedView === "timeline"
        ? "none"
        : "timeline"
    )
  }
  className="text-xs text-zinc-400"
>
  {expandedView === "timeline"
    ? "Restore"
    : "Expand"}
</button>

              </div>

              <div
  className={`
    flex-1
    min-h-0
    border
    border-dashed
    border-[#1F2937]
    rounded-xl
    flex
    items-center
    justify-center
    text-zinc-500
    transition-all
    duration-300
    ${
      expandedView === "timeline"
  ? "flex-1"
  : expandedView === "mixer"
  ? "hidden"
  : "h-[55%]"
    }
  `}
>
                <div className="w-full h-full p-4 relative">

                    {/* Global Playhead */}

<div
  className="
    absolute
    top-[52px]
    bottom-[24px]
    left-[214px]
    w-[1px]
    bg-[#14D8C4]
    z-50
    shadow-[0_0_10px_#14D8C4]
  "
/>



  {/* Ruler */}

  <div className="flex mb-2">

    

  <div
    className="
      w-[180px]
      flex-shrink-0
    "
  />

  <div className="flex-1">

    <div className="grid grid-cols-12 text-xs text-zinc-500">

      {Array.from({
        length: 12,
      }).map((_, i) => (

        <div
          key={i}
          className="
            border-l
            border-[#1F2937]
            pl-2
          "
        >
          {i + 1}
        </div>

      ))}

    </div>

  </div>

</div>

  {/* Tracks */}

  <div
  className="
    space-y-0.5
    h-full
    overflow-y-auto
    pr-2
  "
>

    {[
      "Kick",
      "Bass",
      "Piano",
      "Vocal",
    ].map((track) => (

      <div
  key={track}
  className={`
    flex
    items-center
    gap-0
    h-15
    rounded-lg
    transition
    ${
      selectedTrack === track
        ? "bg-[#14D8C410]"
        : ""
    }
  `}
>

  {/* Track Header */}

  <div
    className="
      w-[180px]
      h-full
      flex
      items-center
      gap-3
      px-3
      border-r
      border-[#1F2937]
      bg-[#0A0A0A40]
      flex-shrink-0
    "
  >

    {/* Mute */}

    <button
      onClick={() =>
        toggleMute(track)
      }
      className={`
        w-7
        h-7
        rounded-md
        border
        text-xs
        ${
          mutedTracks.includes(track)
            ? "border-[#FF6B4A] bg-[#FF6B4A20] text-[#FF6B4A]"
            : "border-[#1F2937]"
        }
      `}
    >
      M
    </button>

    {/* Solo */}

    <button
      onClick={() =>
        toggleSolo(track)
      }
      className={`
        w-7
        h-7
        rounded-md
        border
        text-xs
        ${
          soloTrack === track
            ? "border-[#14D8C4] bg-[#14D8C420] text-[#14D8C4]"
            : "border-[#1F2937]"
        }
      `}
    >
      S
    </button>

    {/* Track Name */}

    <button
      onClick={() =>
        setSelectedTrack(track)
      }
      className={`
        text-left
        text-sm
        transition
        ${
          selectedTrack === track
            ? "text-[#14D8C4]"
            : "text-zinc-300"
        }
      `}
    >
      {track}
    </button>

  </div>





        {/* Fake Waveform */}

        

        <div className="flex-1 h-full relative overflow-hidden rounded-lg border border-[#1F2937] bg-[#0A0A0A]">





{/* Playhead */}





  {/* Grid */}

  

  <div className="absolute inset-0 flex justify-between">

    {Array.from({ length: 12 }).map(
      (_, i) => (
        <div
          key={i}
          className="w-px h-full bg-[#1F2937]"
        />
      )
    )}

  </div>

  {/* Waveform Placeholder */}

  <div
  className="
    absolute
    inset-0
    left-0
    w-full
      flex
      items-center
      px-2
      gap-[2px]
    "
  >

    {[
      20, 40, 65, 35, 80, 50,
      25, 60, 75, 30, 55, 25,
      70, 40, 20, 65, 45, 30,
    ].map((h, i) => (

      <div
        key={i}
        className="w-[3px] rounded-full"
        style={{
          height: `${h}%`,
          backgroundColor: "#14D8C4",
          opacity: 0.85,
        }}
      />

    ))}

  </div>

</div>




      </div>

    ))}

  </div>

</div>




              </div>

            </div>

            <div
  className={`
    bg-[#111827]
    border
    border-[#1F2937]
    rounded-2xl
    p-6
    flex
    flex-col
    min-h-0
    transition-all
    duration-300
    ${
      expandedView === "timeline"
        ? "hidden"
        : expandedView === "mixer"
        ? "flex-1"
        : "h-[40%]"
    }
  `}
>

              <div className="flex items-center justify-between mb-4">

                <h3 className="text-lg font-semibold">
                  Mixer
                </h3>

                <button
  onClick={() =>
    setExpandedView(
      expandedView === "mixer"
        ? "none"
        : "mixer"
    )
  }
  className="text-xs text-zinc-400"
>
  {expandedView === "mixer"
    ? "Restore"
    : "Expand"}
</button>

              </div>

              <div
  className="
    flex
    gap-3
    flex-1
    min-h-0
    overflow-hidden
  "
>

  {/* Track Channels - 65% */}

  <div className="w-[65%] min-w-0 border border-[#1F2937] rounded-xl p-4">

    <h4 className="text-sm text-zinc-400 mb-4">
      Tracks
    </h4>

    <div
  className="
    flex
    gap-2
    flex-1
    min-h-0
    items-end
    overflow-x-auto
    overflow-y-hidden
    min-w-0
  "
>

      {[
        "Kick",
        "Bass",
        "Piano",
        "Vocal",
      ].map((track) => (

        <button
          key={track}
          onClick={() =>
            setSelectedTrack(track)
          }
          className={`
  w-12
  rounded-lg
  border
  border-[#1F2937]
  flex
  flex-col
  items-center
  justify-end
  pb-2
  transition
  flex-shrink-0
  ${
    selectedTrack === track
      ? "bg-[#14D8C410] border-[#14D8C4]"
      : ""
  }
`}
        >

          <div className="w-2 h-[80px] bg-[#1F2937] rounded-full relative mb-3">

            <div
              className="absolute bottom-0 left-0 right-0 rounded-full bg-[#14D8C4]"
              style={{
                height: "60%",
              }}
            />

          </div>

          <span className="text-xs">
            {track}
          </span>

        </button>

      ))}

    </div>

  </div>

  {/* Sends & Buses - 35% */}

  <div className="w-[35%] flex-shrink-0 border border-[#1F2937] rounded-xl p-4">

    <h4 className="text-sm text-zinc-400 mb-4">
      Sends / Buses
    </h4>

    <div className="flex gap-2 flex-1 min-h-0 items-end justify-center overflow-hidden">

      {[
        "Verb",
        "Delay",
      ].map((bus) => (

        <div
          key={bus}
          className="
  w-12
  rounded-lg
  border
  border-[#1F2937]
  flex
  flex-col
  items-center
  justify-end
  pb-2
  flex-shrink-0
"
        >

          <div className="w-2 h-[80px] bg-[#1F2937] rounded-full relative mb-3">

            <div
              className="absolute bottom-0 left-0 right-0 rounded-full bg-[#FF6B4A]"
              style={{
                height: "50%",
              }}
            />

          </div>

          <span className="text-xs">
            {bus}
          </span>

        </div>

      ))}

    </div>

  </div>

</div>

            </div>

          </div>

          {/* Inspector */}

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 overflow-y-auto min-h-0">

            <h3
  className="text-lg font-semibold mb-4"
  style={{
    color: channelColor,
  }}
>
  {selectedTrack}

  {isSendMode
    ? " Sends"
    : " Channel"}
</h3>

           <div className="flex flex-col gap-2 mb-4">

  <button
    onClick={() => setInspectorView("main")}
    className={`
      w-full
      py-2
      rounded-lg
      border
      transition
      ${
        inspectorView === "main"
          ? "border-[#14D8C4]"
          : "border-[#1F2937]"
      }
    `}
  >
    Main
  </button>

  <button
    onClick={() => setInspectorView("sends")}
    className={`
      w-full
      py-2
      rounded-lg
      border
      transition
      ${
        inspectorView === "sends"
          ? "border-[#FF6B4A] bg-[#FF6B4A15]"
          : "border-[#1F2937]"
      }
    `}
  >
    Sends
  </button>

</div>

            {inspectorView ===
            "main" ? (

              <div className="space-y-1">

                <div className="border border-[#1F2937] rounded-lg p-3">
                  Gain
                </div>

                <div className="border border-[#1F2937] rounded-lg p-3">
                  Pan
                </div>

                <div className="border border-[#1F2937] rounded-lg p-3">
                  EQ
                </div>

                <div className="border border-[#1F2937] rounded-lg p-3">
                  Comp
                </div>

              </div>

            ) : (

              <div className="space-y-3">

                <div className="border border-[#1F2937] rounded-lg p-3">
                  Reverb Send
                </div>

                <div className="border border-[#1F2937] rounded-lg p-3">
                  Delay Send
                </div>

                <div className="border border-[#1F2937] rounded-lg p-3">
                  Parallel Comp
                </div>

              </div>

            )}

          </div>

          {/* Channel Strip */}

<div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 overflow-hidden min-h-0 flex flex-col">

  <h3
    className="text-center text-sm font-semibold mb-4"
    style={{
      color: channelColor,
    }}
  >
    {selectedTrack}
  </h3>

  <p className="text-center text-[10px] text-zinc-500 mb-4">

    {isSendMode
      ? "SEND"
      : "TRACK"}

  </p>



<div className="flex-1 min-h-0 flex items-center justify-center gap-2">


  <div className="text-[8px] text-zinc-500 flex flex-col justify-between h-full -ml-2">

    

  <span>0</span>
  <span>-6</span>
  <span>-12</span>
  <span>-18</span>
  <span>-24</span>
  <span>-30</span>

</div>


<div className="w-3 h-full bg-[#1F2937] rounded-full relative">

  <div
    className="absolute bottom-0 left-0 right-0 rounded-full"
    style={{
      height: "72%",
      backgroundColor: channelColor,
    }}
  />

</div>

<div className="w-5 h-full relative">

  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-[#1F2937]" />

  <div
    className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full"
    style={{
      bottom: "72%",
      border: `2px solid ${channelColor}`,
      backgroundColor: "#111827",
    }}
  />

</div>
  </div>

</div>

          {/* Master */}

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 overflow-hidden min-h-0 flex flex-col">

            <h3 className="text-center text-[13px] font-semibold mb-4 -ml-2">
                MASTER
            </h3>

            <p className="text-center text-[10px] text-zinc-500 mb-4">
             BUS
            </p>

            <div className="flex-1 min-h-0 flex items-center justify-center gap-2">

                <div className="text-[8px] text-zinc-500 flex flex-col justify-between h-full -ml-2">

  <span>0</span>
  <span>-6</span>
  <span>-12</span>
  <span>-18</span>
  <span>-24</span>
  <span>-30</span>

</div>

<div className="w-3 h-full bg-[#1F2937] rounded-full relative">

  <div
    className="absolute bottom-0 left-0 right-0 rounded-full"
    style={{
      height: "72%",
      backgroundColor: "#14D8C4",
    }}
  />

</div>

<div className="w-5 h-full relative">

  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-[#1F2937]" />

  <div
    className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full"
    style={{
      bottom: "72%",
      border: "2px solid #14D8C4",
      backgroundColor: "#111827",
    }}
  />

</div>
            </div>

          </div>
         </div>
        </div>

      </div>

    
  );
}