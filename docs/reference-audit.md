# Reference Audit

This audit was completed before changing the current project for the second iteration. The reference repositories were cloned under `.reference-repos/` and reviewed for architecture only. No TOEFL content, media, images, logos, or source files were copied into this project.

## 1. Repository Overview

### hezretaly/toefl

- Technology stack: Vite React frontend, Tailwind/shadcn-style UI, Flask/SQLAlchemy backend.
- License: MIT License.
- Useful ideas: TOEFL-specific section boundaries; separate Reading, Listening, Speaking, Writing routes; intro/test/review flow; timer component; audio player state; speaking phase flow; writing response and word-count workflow; review pages by section.
- Not suitable to migrate: Flask backend, login/admin system, database schema as the runtime source of truth, bundled question/content assumptions, UI component library bulk copy.
- Compatibility: High product-flow compatibility, medium technical compatibility. Current app should adapt the flow while keeping PDF/MP3 manifest files and Next.js App Router.

### Manav-Chudasama/Online-Examination-System

- Technology stack: Next.js App Router, React 19, MongoDB/Mongoose, Biome, role-specific Admin/Teacher/Student routes, auth, encrypted questions, AI integrations.
- License: No LICENSE file found in the cloned repository root. Treat as all rights reserved for code reuse.
- Useful ideas: Test, Question, Result, Session-style domain boundaries; student test attempt and result pages; API route grouping by role; answer snapshots with submission metadata; future teacher/admin boundaries.
- Not suitable to migrate: MongoDB, JWT/auth, encryption, teacher/admin dashboards, AI tools, charts, animations, file parsing pipeline, role enforcement.
- Compatibility: Medium. Domain entities are useful as future type boundaries; implementation details are too heavy for local-only private practice.

### Eljakani/QuizQube

- Technology stack: Next.js App Router, React, Tailwind/shadcn-style UI, S3 pre-signed uploads, AI quiz generation, PDF parsing.
- License: MIT License.
- Useful ideas: File upload state model, file type validation, upload progress, upload errors, decoupling selected files from the final quiz/test record.
- Not suitable to migrate: AWS SDK, PDF parsing, AI generation, animated upload UI, authentication, branded assets.
- Compatibility: Medium. The storage adapter boundary is worth adapting; cloud upload implementation is deferred.

### kiranonline/Online-Examination-System

- Technology stack: older React/Redux frontend, Express/Mongoose backend, Ant Design, answer sheet/result services, Excel-oriented reporting concepts.
- License: MIT License.
- Useful ideas: answer sheet as the durable attempt record; separate sub-result records with correct/given answers and explanations; test portal side panel; explicit end-test action; result generation from saved answers.
- Not suitable to migrate: Express backend, Redux, Ant Design, old class components, auth/registration flow, generated build artifacts.
- Compatibility: Low technical compatibility, medium conceptual compatibility for persistence and result data.

## 2. Patterns Worth Adopting

### Exam State Management

- Use one attempt status instead of several booleans.
- Adopted shape: `not_started`, `in_progress`, `paused`, `submitted`, `expired`.
- Current project should map pause, timeout, submit, and restore through this status.

### Countdown

- Keep the timer controlled by parent attempt state rather than as a hidden local timer.
- Timeout should transition the attempt to `expired` or `submitted`.
- Avoid resetting the timer when unrelated UI state changes.

### Autosave

- Store the attempt as a durable answer sheet.
- Save current question, current PDF page, current audio index, audio position, answers, flags, notes, remaining time, and status.
- Add a schema version wrapper so older localStorage data can be safely migrated.

### Audio Playback

- Track explicit audio state: selected audio, current time, duration, volume, playback rate, status, and play count.
- Centralize replay restrictions so the UI does not duplicate `allowReplay` logic.
- Practice Mode should override replay restrictions.

### Speaking Recording

- TOEFL-specific speaking flow benefits from a phase model, but first version should only add a recording adapter interface and a safe browser adapter.
- No cloud upload or scoring is needed now.

### PDF File Handling

- Keep current native browser PDF rendering.
- From upload-oriented projects, adopt file metadata and storage adapter boundaries.
- Do not add PDF parsing or OCR.

### User Upload

- Adopt generic asset types and storage adapter interfaces.
- Defer actual upload UI and cloud storage SDKs.

### Answer Records

- Treat attempts as first-class records with IDs, status, timestamps, and answers.
- Preserve compatibility with current localStorage sessions.

### Review

- Keep objective scoring separate from review display.
- Include user answer, correct answer, correctness, explanation, note, and flag state.

### Data Analysis

- Defer charts. Keep score result data structured enough for later per-section and per-question analytics.

### Multi-User Extension

- Add optional `workspaceId`, `ownerId`, `userId`, role, and entitlement types.
- Do not expose unavailable commercial or account features in the UI.

## 3. Decision Records

### TOEFL section route separation

- Source: hezretaly/toefl
- Decision: Adapt
- Reason: Useful product structure, but current routes remain manifest-driven under `/practice/[testId]/[section]`.

### Audio playback state machine

- Source: hezretaly/toefl
- Decision: Adapt
- Reason: Useful for TOEFL Listening; must work with local manifest MP3 files, missing-file states, and Practice Mode.

### Speaking phase model

- Source: hezretaly/toefl
- Decision: Defer
- Reason: The phase model is valuable, but first add adapter interfaces without implementing full TOEFL speaking timing.

### Browser MediaRecorder adapter

- Source: hezretaly/toefl concept, browser API
- Decision: Adopt
- Reason: A small native adapter prepares the codebase for local speaking recording without adding dependencies.

### MongoDB/Mongoose domain models

- Source: Manav-Chudasama/Online-Examination-System and kiranonline/Online-Examination-System
- Decision: Adapt
- Reason: Entity boundaries are useful, but current project remains local manifest plus localStorage.

### Admin/Teacher/Student routes

- Source: Manav-Chudasama/Online-Examination-System
- Decision: Defer
- Reason: Future commercial/multi-user boundary only. No login or role UI now.

### Auth, encryption, anti-cheat

- Source: Manav-Chudasama/Online-Examination-System
- Decision: Reject
- Reason: Outside current private local scope and would add unnecessary dependencies.

### File upload progress model

- Source: Eljakani/QuizQube
- Decision: Adapt
- Reason: Good future upload boundary, but current version only defines storage and asset types.

### S3 storage implementation

- Source: Eljakani/QuizQube
- Decision: Defer
- Reason: No cloud SDKs in the first local version.

### Answer sheet/result separation

- Source: kiranonline/Online-Examination-System
- Decision: Adapt
- Reason: Durable attempts and derived review results fit the localStorage model.

### Redux/Ant Design/Express architecture

- Source: kiranonline/Online-Examination-System
- Decision: Reject
- Reason: Incompatible with current Next.js App Router, TypeScript, Tailwind, and lightweight UI constraints.
