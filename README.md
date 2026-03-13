# SPH Gmail - Superhuman AI for Gmail

A Zen Browser / Firefox extension that brings Superhuman-style AI capabilities to Gmail.

## Features

- **Triage & Priority Inbox** — AI auto-classifies emails as Important, Action Required, FYI, Notification, or Low Priority with color-coded badges
- **AI Email Compose** — Generate full emails from short prompts, rewrite drafts, adjust tone, and auto-complete while typing
- **Email Summaries** — One-click AI summaries of emails and full threads with key points, action items, and timeline
- **Smart Reply Suggestions** — Contextual reply chips with different tones; click to auto-fill the reply box

## Supported AI Providers

Choose your own AI backend:

| Provider | Models | Notes |
|----------|--------|-------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo | Requires API key |
| **Anthropic** | claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6 | Requires API key |
| **Google Gemini** | gemini-2.0-flash, gemini-2.5-pro | Requires API key |
| **Ollama** | llama3, mistral, phi3, gemma2 | Free, runs locally |

## Installation

### Zen Browser / Firefox

1. Clone this repository
2. Generate icons (optional): `bash icons/generate-icons.sh`
3. Open Zen Browser and navigate to `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on**
5. Select the `manifest.json` file from this repo
6. Open Gmail — you'll see the setup banner

### Permanent Install

Package the extension as an `.xpi` file:
```bash
cd SPH-GMAIL
zip -r sph-gmail.xpi . -x '.git/*' -x '*.sh'
```
Then drag `sph-gmail.xpi` into Zen Browser to install.

## Setup

1. Click the extension icon or the setup banner in Gmail
2. Select your AI provider (OpenAI, Anthropic, Gemini, or Ollama)
3. Enter your API key and choose a model
4. Click **Test Connection** to verify
5. Click **Save Settings**
6. Reload Gmail

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+T` | Triage inbox |
| `Alt+S` | Summarize current thread |
| `Alt+R` | Generate smart replies |
| `Alt+P` | Toggle sidebar |
| `Tab` | Auto-complete in compose |

## Architecture

```
SPH-GMAIL/
├── manifest.json              # Extension manifest (MV2, Firefox/Zen compatible)
├── src/
│   ├── providers/             # AI provider abstraction layer
│   │   ├── provider-base.js   # Base interface
│   │   ├── openai.js          # OpenAI GPT
│   │   ├── anthropic.js       # Anthropic Claude
│   │   ├── gemini.js          # Google Gemini
│   │   ├── ollama.js          # Ollama (local)
│   │   └── provider-factory.js
│   ├── features/              # AI feature modules
│   │   ├── triage.js          # Priority classification
│   │   ├── compose.js         # AI drafting & rewriting
│   │   ├── summarize.js       # Email/thread summaries
│   │   └── smart-reply.js     # Reply suggestions
│   ├── content/               # Gmail page integration
│   │   ├── gmail-dom.js       # DOM reading/manipulation
│   │   └── main.js            # Entry point & orchestrator
│   ├── background/
│   │   └── background.js      # Extension background script
│   └── ui/
│       └── styles.css          # All extension styles
├── options/                   # Settings page
│   ├── options.html
│   └── options.js
├── popup/                     # Browser action popup
│   ├── popup.html
│   └── popup.js
└── icons/
    └── icon.svg               # Source icon
```

## Privacy

- Your API keys are stored locally in browser storage only
- Email content is sent directly to your chosen AI provider — no intermediary servers
- When using Ollama, everything stays on your machine
