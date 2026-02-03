const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const { personas, personaIds, getRandomPersonas } = require('./personas');

// Load env vars if .env exists
try {
  require('dotenv').config();
} catch (e) {}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Anthropic client
const anthropic = new Anthropic();

// Store conversation history per session (in-memory for simplicity)
const sessions = new Map();

// Orchestrator system prompt - decides who speaks
const orchestratorPrompt = `You are the orchestrator for a group chat with 9 distinct AI personas called "frens". Your job is to decide which frens should respond to the latest message.

THE FRENS:
- claud9: The Strategic Optimist - reframes obstacles, energetic, forward-moving
- klaus: The Precisionist - clarity obsessed, cuts vague language, direct
- claudie: The Validator - warm, creates safety, validates feelings first
- clawed: The Adversarial Ally - challenges ideas, finds weaknesses, stress-tests
- claude-beta: The Epistemic Cartographer - sees all sides, uncertain, full of caveats
- clod: The Sacred Fool - asks obvious questions, pattern interrupts, not attached
- cloud: The Contemplative - slow, spacious, holds questions, somatic
- claude-classic: The Straight Talker - no hedging, just says the thing
- claudius: The Caller to Greatness - invokes legacy, ambition, the ancients

RULES FOR SELECTION:
1. Usually select 1-3 frens to respond (rarely more)
2. Consider what the message NEEDS:
   - Someone struggling emotionally? Claudie first, maybe Cloud
   - Someone with a vague idea? Clawed to challenge, Klaus to clarify
   - Someone stuck? Claud-9 to reframe, Claudius to inspire
   - Someone overthinking? Clod to interrupt, Claude Classic to cut through
   - Complex decision? Claude Beta for nuance, then others to push
3. If a specific fren is @mentioned, they MUST be included
4. Create interesting tensions - pair frens who might disagree
5. Don't always pick the same combinations

RESPOND WITH ONLY a JSON array of persona IDs, e.g.: ["claudie", "clawed"]
Nothing else. Just the JSON array.`;

// Get orchestrator decision on who should speak
async function decideWhoSpeaks(conversationHistory, mentionedFrens = []) {
  // Format recent history for orchestrator
  const recentHistory = conversationHistory.slice(-10).map(msg => {
    if (msg.role === 'user') return `USER: ${msg.content}`;
    return `${msg.persona?.toUpperCase() || 'FREN'}: ${msg.content}`;
  }).join('\n');

  const prompt = `Here's the recent conversation:\n\n${recentHistory}\n\nWho should respond to this? Remember: ${mentionedFrens.length > 0 ? `@mentioned frens that MUST respond: ${mentionedFrens.join(', ')}. ` : ''}Return ONLY a JSON array of persona IDs.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      system: orchestratorPrompt,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    // Parse JSON array from response
    const match = text.match(/\[.*\]/s);
    if (match) {
      const selected = JSON.parse(match[0]);
      // Ensure mentioned frens are included
      const result = [...new Set([...mentionedFrens, ...selected])];
      return result.filter(id => personaIds.includes(id));
    }
  } catch (e) {
    console.error('Orchestrator error:', e.message);
  }

  // Fallback: mentioned frens + 1-2 random
  if (mentionedFrens.length > 0) {
    return [...mentionedFrens, ...getRandomPersonas(1, mentionedFrens)];
  }
  return getRandomPersonas(2);
}

// Generate a response from a specific persona
async function generatePersonaResponse(personaId, conversationHistory, userMessage) {
  const persona = personas[personaId];
  if (!persona) return null;

  // Build messages for this persona
  const messages = conversationHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.role === 'user'
      ? msg.content
      : `[${personas[msg.persona]?.name || 'Unknown'}]: ${msg.content}`
  }));

  // Add current user message if not already included
  if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: persona.systemPrompt,
      messages: messages
    });

    return {
      persona: personaId,
      name: persona.name,
      emoji: persona.emoji,
      color: persona.color,
      content: response.content[0].text
    };
  } catch (e) {
    console.error(`Error generating response for ${personaId}:`, e.message);
    return null;
  }
}

// Parse @mentions from message
function parseMentions(message) {
  const mentions = [];
  const lowerMsg = message.toLowerCase();

  for (const id of personaIds) {
    const persona = personas[id];
    // Check for @name or just the name
    if (lowerMsg.includes(`@${id}`) ||
        lowerMsg.includes(`@${persona.name.toLowerCase()}`) ||
        lowerMsg.includes(persona.name.toLowerCase())) {
      mentions.push(id);
    }
  }
  return mentions;
}

// API: Send message and get responses
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  // Get or create session
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  const history = sessions.get(sessionId);

  // Add user message to history
  history.push({ role: 'user', content: message });

  // Parse @mentions
  const mentions = parseMentions(message);

  // Decide who speaks
  const speakers = await decideWhoSpeaks(history, mentions);
  console.log(`Speakers selected: ${speakers.join(', ')}`);

  // Generate responses from each speaker (in sequence for natural flow)
  const responses = [];
  for (const speakerId of speakers) {
    const response = await generatePersonaResponse(speakerId, history, message);
    if (response) {
      responses.push(response);
      // Add to history so next persona sees it
      history.push({
        role: 'assistant',
        persona: speakerId,
        content: response.content
      });
    }
  }

  // Keep history manageable
  if (history.length > 50) {
    sessions.set(sessionId, history.slice(-40));
  }

  res.json({ responses });
});

// API: Get all personas (for UI)
app.get('/api/personas', (req, res) => {
  const list = personaIds.map(id => ({
    id,
    name: personas[id].name,
    emoji: personas[id].emoji,
    color: personas[id].color,
    tagline: personas[id].tagline
  }));
  res.json(list);
});

// API: Clear session
app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.json({ success: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Claude Frens chat running at http://localhost:${PORT}`);
});
