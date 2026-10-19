# Speak Easy

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-gray) ![Workers AI](https://img.shields.io/badge/Workers_AI-gray) ![OpenSpec](https://img.shields.io/badge/OpenSpec-enforced-blueviolet) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

> English speaking coach for Spanish speakers: type Spanish, get the English plus how it sounds, written the way a Spanish speaker reads.

---

## Quick start

There is no npm install and no build step for local checks. Clone the repo and run the test gate:

```bash
git clone https://github.com/arananet/speak-easy.git
cd speak-easy
sh scripts/test.sh
```

The test gate builds the worker, syntax-checks every module, runs a 13-check functional smoke test against the login and session logic, validates the phrase packs and the spec files, and rejects secrets and leftover placeholders. Run it before every commit.

The app itself runs on Cloudflare Workers (see [Deploy](#deploy)). It cannot run fully locally because translation calls Workers AI through the Worker's AI binding.

---

## Usage

The UI is in Spanish and mobile-first. Open the deployed URL, log in, and:

* **Español → English:** type a phrase in Spanish, tap Traducir, and get the natural US English plus the pronunciation spelled for a Spanish reader. Example: "My name is Eduardo" becomes "Mai neim is Eduardo".
* **English → pronunciación:** type English you heard or read somewhere and get just the pronunciation spelling.
* **🔊 Escuchar:** every English result has a listen button that plays it aloud with the browser's built-in US English voice, slightly slowed.
* **Frases para practicar:** curated phrase packs with hand-written phonetics, no AI call needed. The launch packs are caregiving phrases, everyday phrases, and emergencies.
* **Recientes:** your last 20 translations are kept on the device, tap to reopen.

---

## How it works

One Cloudflare Worker serves everything:

* `GET /` serves the login page or the app, depending on the session cookie.
* `GET /app.js`, `/styles.css` serve the frontend; `GET /api/phrases` serves the phrase packs.
* `POST /api/translate` takes `{text, source}` and calls Workers AI (`@cf/meta/llama-3.1-8b-instruct`) through the Worker's AI binding. The prompt carries few-shot examples that teach the model the Spanish-orthography phonetic convention, and the server parses and validates the strict JSON `{english, phonetic}` before responding.
* The frontend files are inlined into the worker at build time by `scripts/build.js`, so deployment is a single API call and no token ever reaches the browser.

Specs live under [`.openspec/specs/`](.openspec/specs/): app shell and login, translate and phonetic inference, phrase packs and pronunciation.

---

## Login

The repo is public, so the app is password-protected. The password lives **only** as a Cloudflare Worker secret named `APP_PASSWORD`. It is never committed to the repo, never appears in logs, and the test gate fails if anything secret-like is committed.

**Set or rotate the password** (pick one):

```bash
# from a terminal with the Cloudflare API token available
python3 scripts/deploy-worker.py set-secret
```

Or in the Cloudflare dashboard: Workers & Pages → speak-easy → Settings → Variables and Secrets → add secret `APP_PASSWORD`. Or with wrangler: `npx wrangler secret put APP_PASSWORD`.

**For Blanca:** open the app URL, type the password once, and the session lasts 30 days on that device. There is a Salir button to log out.

---

## Deploy

The Cloudflare API token needs **Workers Scripts Edit** on the account (the AI binding uses the account's Workers AI entitlement, no extra token needed).

```bash
python3 scripts/deploy-worker.py deploy      # build + upload worker with the AI binding
python3 scripts/deploy-worker.py set-secret  # set the login password (hidden prompt)
python3 scripts/deploy-worker.py url         # print the workers.dev URL
```

After deploy, log in and translate "Me llamo Blanca" as a first live check: the phonetic line should read naturally when read aloud by a Spanish speaker.

---

## Contributing

This project uses Spec-Driven Development with [arananet/openspec-template](https://github.com/arananet/openspec-template). Specs live under [`.openspec/specs/`](.openspec/specs/) and are written before implementation changes. Open a spec change for review before building the feature, and keep `sh scripts/test.sh` green.

---

## Documentation

| Topic | Where |
| --- | --- |
| Feature specs | [`.openspec/specs/`](.openspec/specs/) |
| Spec-driven workflow config | [`.openspec/config.yaml`](.openspec/config.yaml) |
| Login and secrets | [README](#login) |
| Deploy on Cloudflare Workers | [README](#deploy) |
| Release history | [`CHANGELOG.md`](CHANGELOG.md) |

---

## License

[MIT](LICENSE)

---

## Developer

Eduardo Arana

## Support this with a ko-fi

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H51MPWG)
