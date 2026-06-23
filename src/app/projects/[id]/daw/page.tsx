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
    <div className="min-h-screen bg-[#0A0A0A] text-white">

      {/* Header */}

      <div className="border-b border-[#1F2937] px-8 py-6">

        <div className="flex items-center justify-between">

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

      <div className="p-6">

        {/* Session Bar */}

        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 mb-6">

            <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">

  <p className="text-xs text-zinc-500">
    Project
  </p>

  <p className="text-xl font-semibold truncate">
    Coffee Test
  </p>

</div>



          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <p className="text-xs text-zinc-500">
              Tempo
            </p>

            <p className="text-xl font-semibold">
              --
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <p className="text-xs text-zinc-500">
              Key
            </p>

            <p className="text-xl font-semibold">
              --
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <p className="text-xs text-zinc-500">
              Signature
            </p>

            <p className="text-xl font-semibold">
              --
            </p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">

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

        <div className="grid grid-cols-[180px_1fr_220px_90px_70px] gap-4">

          {/* Tracks */}

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4">

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

          <div className="space-y-4">

            <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">

              <div className="flex items-center justify-between mb-4">

                <h3 className="text-lg font-semibold">
                  Timeline
                </h3>

                <button className="text-xs text-zinc-400">
                  Expand
                </button>

              </div>

              <div className="h-[500px] border border-dashed border-[#1F2937] rounded-xl flex items-center justify-center text-zinc-500">
                Timeline Coming Soon
              </div>

            </div>

            <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">

              <div className="flex items-center justify-between mb-4">

                <h3 className="text-lg font-semibold">
                  Mixer
                </h3>

                <button className="text-xs text-zinc-400">
                  Expand
                </button>

              </div>

              <div className="h-[220px] border border-dashed border-[#1F2937] rounded-xl flex items-center justify-center text-zinc-500">
                Mixer Coming Soon
              </div>

            </div>

          </div>

          {/* Inspector */}

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">

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

            <div className="flex gap-2 mb-4">

              <button
                onClick={() =>
                  setInspectorView(
                    "main"
                  )
                }
                className={`
  px-3 py-1
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
                onClick={() =>
                  setInspectorView(
                    "sends"
                  )
                }
                className={`
  px-3 py-1
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

              <div className="space-y-3">

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
                  Compressor
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

<div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 h-full">

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

  <div className="h-[600px] flex items-center justify-center gap-3">

    <div className="text-[8px] text-zinc-500 flex flex-col justify-between h-[520px] -ml-2">

  <span>0</span>
  <span>-6</span>
  <span>-12</span>
  <span>-18</span>
  <span>-24</span>
  <span>-30</span>

</div>

<div className="w-3 h-[520px] bg-[#1F2937] rounded-full relative">

  <div
    className="absolute bottom-0 left-0 right-0 rounded-full"
    style={{
      height: "72%",
      backgroundColor: channelColor,
    }}
  />

</div>

<div className="w-5 h-[520px] relative">

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

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 h-full">

            <h3 className="text-center text-sm font-semibold mb-4">
             MASTER
            </h3>

            <p className="text-center text-[10px] text-zinc-500 mb-4">
             BUS
            </p>

            <div className="h-[600px] flex items-center justify-center gap-3">

                <div className="text-[8px] text-zinc-500 flex flex-col justify-between h-[520px] -ml-2">

  <span>0</span>
  <span>-6</span>
  <span>-12</span>
  <span>-18</span>
  <span>-24</span>
  <span>-30</span>

</div>

<div className="w-3 h-[520px] bg-[#1F2937] rounded-full relative">

  <div
    className="absolute bottom-0 left-0 right-0 rounded-full"
    style={{
      height: "72%",
      backgroundColor: "#14D8C4",
    }}
  />

</div>

<div className="w-5 h-[520px] relative">

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