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

const channelColor =
  isSendMode
    ? "#FF6B4A"
    : "#14D8C4";

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

        <div className="grid grid-cols-[1fr_1fr_1fr_2fr] gap-4 mb-6">

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

        <div className="grid grid-cols-[180px_1fr_260px_90px_90px] gap-4">

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
              ].map((track) => (

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
                        ? "border-[#14D8C4]"
                        : "border-[#1F2937]"
                    }
                  `}
                >
                  {track}
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

              <div className="h-[350px] border border-dashed border-[#1F2937] rounded-xl flex items-center justify-center text-zinc-500">
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
      ? "border-[#FF6B4A]"
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

<div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3">

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

  <div className="h-[300px] flex justify-center">

    <div className="w-4 bg-[#1F2937] rounded-full relative">

      <div
        className="absolute bottom-0 left-0 right-0 rounded-full"
        style={{
          height: "72%",
          backgroundColor:
            channelColor,
        }}
      />

    </div>

  </div>

  <div className="mt-4 text-center">

    <div
      className="w-8 h-8 rounded-full mx-auto"
      style={{
        border:
          `2px solid ${channelColor}`,
      }}
    />

  </div>

</div>

          {/* Master */}

          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4">

            <h3 className="text-center font-semibold mb-6">
              Master
            </h3>

            <div className="h-[600px] flex items-center justify-center">

              <div className="w-10 h-[300px] bg-[#1F2937] rounded-full relative">

                <div
                  className="
                    absolute
                    bottom-0
                    left-0
                    right-0
                    rounded-full
                  "
                  style={{
                    height: "65%",
                    backgroundColor:
                      "#14D8C4",
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