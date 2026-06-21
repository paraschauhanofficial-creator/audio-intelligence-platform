import {
  NOTES,
  MAJOR_PROFILE,
  MINOR_PROFILE,
} from "./musicTheory";

export function rotateProfile(
  profile: number[],
  shift: number
) {
  return [
    ...profile.slice(shift),
    ...profile.slice(0, shift),
  ];
}

export function generateKeyProfiles() {
  const profiles = [];

  for (let i = 0; i < NOTES.length; i++) {
    profiles.push({
      key: NOTES[i],
      scale: "Major",
      profile: rotateProfile(
        MAJOR_PROFILE,
        i
      ),
    });

    profiles.push({
      key: NOTES[i],
      scale: "Minor",
      profile: rotateProfile(
        MINOR_PROFILE,
        i
      ),
    });
  }

  return profiles;
}