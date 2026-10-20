# Changelog

## 2026-10-19 — Fix: deprecated Workers AI model

* `@cf/meta/llama-3.1-8b-instruct` was deprecated by Cloudflare on 2026-05-30 (Workers AI error 5028); every translation returned 502. Switched to the successor `@cf/meta/infire-llama-3.1-8b-instruct`.
* The successor answers in the OpenAI chat completion shape, so the worker now calls it with the messages format and reads the text from `choices[0].message.content` with a fallback to the classic `response` field.

## 2026-10-19 — Initial release

* Speak Easy: English speaking coach for Spanish speakers, built for Blanca.
* Spanish to English translation with Spanish-orthography phonetics ("My name is Eduardo" becomes "Mai neim is Eduardo"), plus an English to pronunciation mode.
* Curated phrase packs with hand-written phonetics: caregiving, everyday, emergencies.
* Listen button with the browser's built-in US English text-to-speech.
* Password login; the password lives only as the `APP_PASSWORD` Cloudflare Worker secret, never in the repo.
* Single Cloudflare Worker serves the UI and the API; inference runs on Workers AI through the Worker's AI binding.
* Spec-Driven Development from the start: three specs under `.openspec/specs/`, onboarded from arananet/openspec-template.
