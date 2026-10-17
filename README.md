# TOEFL Simulator

Private Next.js TOEFL practice simulator for PDF and MP3 based test sets. The first version is a stable local framework: it does not OCR PDFs, parse answers from PDFs, call AI APIs, or claim official TOEFL scoring.

## Install

```bash
npm install
```

## Start

```bash
npm run dev
```

The dev script automatically runs `npm run sync-content`, which copies PDF and audio files from the configured content folder into `public/content/`.

## Build

```bash
npm run build
```

## Where To Put PDF And MP3 Files

By default, keep original materials under `content/`:

```text
content/
  test-001/
    manifest.json
    pdf/
      questions.pdf
      answers.pdf
    audio/
      001.mp3
      002.mp3
      003.mp3
```

Do not copy files into `public/content/` yourself. The sync script does that for local serving.

You can also point the project at an external folder by creating `content-source.local.json`:

```json
{
  "contentDir": "/Users/hanyue/Downloads/真题合集7-5"
}
```

This local file is ignored by git. The app will scan that folder, copy supported PDF/audio files into `public/content/`, and auto-generate basic test manifests for folders that do not yet have `manifest.json`.

Supported first-version media extensions:

- `.pdf`
- `.mp3`
- `.m4a`
- `.wav`
- `.mp4`

Files still downloading, such as `.baiduyun.p.downloading`, are ignored.

Auto-generated manifests only connect files to Reading, Listening, Speaking, and Writing by filename. They do not OCR, parse questions, extract answers, or create official scoring.

## Create A New Test

1. Copy `content/sample-test/` to a new safe folder name, for example `content/test-001/`.
2. Change `id` in `manifest.json` to match the folder name exactly.
3. Add your PDF and MP3 files inside that folder.
4. Reference files with relative paths such as `pdf/questions.pdf` or `audio/001.mp3`.

## Manifest Fields

Top-level fields:

- `id`: safe test id, matching folder name.
- `title`: display name.
- `description`: optional display description.
- `version`: manifest version number.
- `sections`: contains `reading`, `listening`, `speaking`, and `writing`.

Section fields:

- `enabled`: whether this section can be opened.
- `title`: display title.
- `durationMinutes`: countdown duration.
- `pdf`: relative PDF path or `null`.
- `audio`: audio item list.
- `questions`: structured question list.

Question fields:

- `id`: stable question id.
- `number`: displayed question number.
- `type`: `single_choice`, `multiple_choice`, `text`, `essay`, or `speaking_placeholder`.
- `prompt`: optional prompt shown in the answer panel.
- `options`: choices for objective questions.
- `correctAnswer`: string or string array.
- `explanation`: review text.
- `page`: PDF page hint.
- `audioId`: related audio id.
- `tags`, `notes`, `maxSelections`: optional extension fields.

## Add Answers

For single choice:

```json
{ "correctAnswer": "B" }
```

For multiple choice:

```json
{ "correctAnswer": ["A", "C"], "maxSelections": 2 }
```

Text, essay, and speaking placeholder questions are not auto-graded.

## Change Question Count

Edit the `questions` array in the section. The practice page generates question navigation from this array, so no page code changes are needed.

## Link Questions To PDF Pages

Add `page` to each question:

```json
{ "id": "reading-3", "number": 3, "type": "text", "page": 4 }
```

The first version shows page hints and includes PDF page controls. It does not detect question regions in the PDF.

## Link Questions To Audio

Add an audio item in the section:

```json
{ "id": "listening-audio-1", "title": "Conversation 1", "file": "audio/001.mp3", "allowReplay": true }
```

Then reference it from a question:

```json
{ "audioId": "listening-audio-1" }
```

When `allowReplay` is `false`, replay can be locked outside Practice Mode. In Practice Mode the limit is disabled for easier local testing.

## localStorage Data

The app stores local-only data with these keys:

- `toefl.settings`
- `toefl.sessions`
- `toefl.history`
- `toefl.mistakes`
- `toefl.lastSession`

There is no login and no cloud database.

## Clear Practice Records

Open `/settings` and use:

- Clear progress
- Clear mistakes

Both actions ask for confirmation.

## Current Non-Goals

- No user login
- No cloud sync
- No payments
- No OCR
- No PDF question extraction
- No answer extraction from answer PDFs
- No AI API calls
- No official adaptive algorithm
- No official TOEFL score conversion

## Recommended Next Development Order

1. Add real TOEFL-style manifests for your existing materials.
2. Improve full-test flow across sections.
3. Add browser microphone recording for Speaking.
4. Add writing draft/version history.
5. Add richer review reports and per-question statistics.
6. Add optional AI writing and speaking feedback.
7. Add a structured question editor and importer.
8. Add cloud sync and accounts only after the local workflow feels solid.

Production deployments on Vercel must set `DATABASE_URL` to a PostgreSQL connection string. The app creates and transactionally updates a single `emock_app_state` row for users, sessions, orders, payment events, entitlements, refunds, and account snapshots. Local development continues to use `data/dev-commerce.json` when `DATABASE_URL` is absent.
