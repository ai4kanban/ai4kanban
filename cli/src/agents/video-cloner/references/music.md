# Music

Score the clone with new music that follows the source's rhythm, never its melody.

## Drafts

- **Analyse**: extract the source's audio with ffmpeg and take its BPM, downbeats, onsets and energy curve with librosa.
- **Cue sheet**: write `cues.json` in the files folder, one entry per beat id: where a section rises or falls, where accents land, and each sound effect's time and kind, plus one line on the score's mood and instrumentation as the video suggests them.

## Template

- **Generate**: create the default score with `akb cloud music --seconds <n> --out <file> "<prompt>"`, where `<n>` is the beat table's total length, which spends the user's Pro credits per track. The prompt gives the tempo, mood, instrumentation, instrumental only, and each section's time range from the cue sheet; never the source's title, artist, lyrics or audio.
- **Align**: trim or time-stretch the track to that length so its accents land on the cue times and it ends with the last beat, and put it in the content file's music slot for the user to replace.
- **Refused**: when Cloud refuses, leave the music slot empty and say so on the card.
- **Clicks**: give every click in the beat table a short click sound synthesised in code.

## Check

- **Compare**: compare the clone's onsets and energy curve with the source's beat by beat; realign a beat whose accents miss, and regenerate only when the track's structure misses, at most three times per run.
