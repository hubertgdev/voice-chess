# Vosk models

This folder is populated automatically before `dev` / `build` by
`scripts/fetch-vosk-models.mjs`, which:

1. Downloads the small Vosk model zips from <https://alphacephei.com/vosk/models>.
2. Unzips them and repackages each as a single `.tar.gz` — the only
   archive format `vosk-browser` accepts.

The resulting files (~40 MB each) are git-ignored:

- `vosk-model-small-en-us-0.15.tar.gz`
- `vosk-model-small-fr-0.22.tar.gz`

To update a model version, edit the `MODELS` array in the script and
delete the old `.tar.gz` so the next build re-downloads.
