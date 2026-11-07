# Narration voices

Generate with `akb cloud tts --voice <name> [--tier standard|premium] --out <file> "<text>"`. Pick from the group of the narration's language; a voice reads only its own language, except the multilingual group, which speaks every language. Chinese voices write `.mp3`.

## Chinese

| Voice | Tone |
| --- | --- |
| Yunzhou | Male, crisp professional |
| Mingxuan | Male, confident presenter |
| Haoran | Male, warm mature |
| Zihao | Male, gentle young |
| Xinyi | Female, composed mature |
| Ruoxi | Female, clear presenter |
| Tianqing | Female, sweet bright |
| Wanyu | Female, calm knowing |

## English

| Voice | Tone |
| --- | --- |
| Arthur | Male, warm British storyteller |
| Graham | Male, deep resonant |
| Edmund | Male, steady British newsreader |
| Miles | Male, friendly smooth |
| Clara | Female, confident warm |
| Hazel | Female, clear British teacher |
| Ivy | Female, upbeat friendly |
| Nora | Female, bright youthful |

## Multilingual

| Voice | Tone |
| --- | --- |
| Zephyr | Bright |
| Puck | Upbeat |
| Charon | Informative |
| Kore | Firm |
| Fenrir | Excitable |
| Leda | Youthful |
| Orus | Firm |
| Aoede | Breezy |
| Callirrhoe | Easy-going |
| Autonoe | Bright |
| Enceladus | Breathy |
| Iapetus | Clear |
| Umbriel | Easy-going |
| Algieba | Smooth |
| Despina | Smooth |
| Erinome | Clear |
| Algenib | Gravelly |
| Rasalgethi | Informative |
| Laomedeia | Upbeat |
| Achernar | Soft |
| Alnilam | Firm |
| Schedar | Even |
| Gacrux | Mature |
| Pulcherrima | Forward |
| Achird | Friendly |
| Zubenelgenubi | Casual |
| Vindemiatrix | Gentle |
| Sadachbia | Lively |
| Sadaltager | Knowledgeable |
| Sulafat | Warm |

When the script fails, tell the user why and offer local Kokoro voices (`hyperframes tts --list`) or a retry; never switch silently.
