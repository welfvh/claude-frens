# Claude Frens Chat

A multi-persona chat web app where the Claude Frens show up as distinct personalities in conversation.

## Features

- **9 Distinct Personas**: Each fren has their own voice, color, emoji, and personality
- **Smart Turn-Taking**: An orchestrator decides which frens should respond based on context
- **@Mentions**: Tag specific frens to include them in the conversation
- **Conversation Memory**: Frens see what other frens have said and can build on it
- **Beautiful UI**: Dark theme with distinct visual identity for each persona

## The Frens

| Emoji | Name | Role |
|-------|------|------|
| ☀️ | Claud-9 | The Strategic Optimist |
| ✂️ | Klaus | The Precisionist |
| 🌸 | Claudie | The Validator |
| ⚔️ | Clawed | The Adversarial Ally |
| 🌀 | Claude Beta | The Epistemic Cartographer |
| 🍃 | Clod | The Sacred Fool |
| ☁️ | Cloud | The Contemplative |
| 📌 | Claude Classic | The Straight Talker |
| 🏛️ | Claudius | The Caller to Greatness |

## Setup

1. Make sure you have Node.js installed
2. Set your Anthropic API key:
   ```bash
   export ANTHROPIC_API_KEY=your-key-here
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open http://localhost:3000 in your browser

## How It Works

1. **User sends a message** → Frontend sends to `/api/chat`
2. **Orchestrator decides** → A Claude call analyzes the message and picks 1-3 frens to respond
3. **Each fren responds** → Sequential API calls with persona-specific system prompts
4. **Frens see each other** → Each fren's response is added to context for the next fren
5. **UI renders responses** → Staggered animation shows each fren's distinct message

## API Endpoints

- `POST /api/chat` - Send a message, get fren responses
- `GET /api/personas` - Get list of all personas
- `POST /api/clear` - Clear conversation history

## Tech Stack

- **Backend**: Node.js + Express
- **AI**: Claude API via @anthropic-ai/sdk
- **Frontend**: Vanilla HTML/CSS/JS (no build step)
