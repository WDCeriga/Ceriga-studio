# Ceriga Artwork Engine

New Artwork code lives here, split by responsibility (plan rule R1 in
`docs/builder-audit/ARTWORK-REDESIGN.md`). `PrintStudioEditor.tsx` is being
taken apart incrementally — **no new feature may grow it**.

| Folder | Responsibility |
|---|---|
| `state/` | Document store adapters, selection, workspace state (Browse / Create / Select / Direct edit / Multi-select / Effect edit / Pattern edit / Focus) |
| `geometry/` | Pure geometry: shape generators, booleans, offsets, warps, alignment & distribution maths |
| `interaction/` | Tools, selection chrome, handles, snapping |
| `rendering/` | Object renderers |
| `preview/` | Gallery thumbnails, workers, caches |
| `inspector/` | Quick / Adjust / Advanced inspector sections |

Rules: pure functions in `geometry/` and `state/` (unit-testable, no React);
components import from the folder index, never from deep paths in the monolith.
