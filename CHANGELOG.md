# Changelog

## 2026-10-19 — Initial release

* Speak Easy: English speaking coach for Spanish speakers, built for Blanca.
* Spanish to English translation with Spanish-orthography phonetics ("My name is Eduardo" becomes "Mai neim is Eduardo"), plus an English to pronunciation mode.
* Curated phrase packs with hand-written phonetics: caregiving, everyday, emergencies.
* Listen button with the browser's built-in US English text-to-speech.
* Password login; the password lives only as the `APP_PASSWORD` Cloudflare Worker secret, never in the repo.
* Single Cloudflare Worker serves the UI and the API; inference runs on Workers AI through the Worker's AI binding.
* Spec-Driven Development from the start: three specs under `.openspec/specs/`, onboarded from arananet/openspec-template.
