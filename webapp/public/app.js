// Claude Frens Chat - Frontend

const API_BASE = '';
let sessionId = localStorage.getItem('frens-session') || generateSessionId();
let personas = [];

// Generate a unique session ID
function generateSessionId() {
  const id = 'session-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  localStorage.setItem('frens-session', id);
  return id;
}

// DOM Elements
const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const personaList = document.getElementById('persona-list');
const clearBtn = document.getElementById('clear-btn');

// Initialize app
async function init() {
  await loadPersonas();
  setupEventListeners();
}

// Load personas from API
async function loadPersonas() {
  try {
    const res = await fetch(`${API_BASE}/api/personas`);
    personas = await res.json();
    renderPersonaList();
  } catch (e) {
    console.error('Failed to load personas:', e);
  }
}

// Render sidebar persona list
function renderPersonaList() {
  personaList.innerHTML = personas.map(p => `
    <div class="persona-item" style="border-left: 3px solid ${p.color}">
      <span class="persona-emoji">${p.emoji}</span>
      <div class="persona-info">
        <div class="persona-name" style="color: ${p.color}">${p.name}</div>
        <div class="persona-tagline">${p.tagline}</div>
      </div>
    </div>
  `).join('');
}

// Setup event listeners
function setupEventListeners() {
  chatForm.addEventListener('submit', handleSubmit);
  clearBtn.addEventListener('click', clearChat);

  // Enable/disable send button based on input
  messageInput.addEventListener('input', () => {
    sendBtn.disabled = !messageInput.value.trim();
  });
}

// Handle form submit
async function handleSubmit(e) {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  // Clear input
  messageInput.value = '';
  sendBtn.disabled = true;

  // Remove welcome message if present
  const welcome = messagesEl.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  // Add user message
  addMessage({
    role: 'user',
    content: message
  });

  // Show typing indicator
  showTypingIndicator();

  try {
    // Use SSE for streaming responses
    const url = `${API_BASE}/api/chat/stream?sessionId=${encodeURIComponent(sessionId)}&message=${encodeURIComponent(message)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'speakers') {
        // Update typing indicator with who's thinking
        updateTypingIndicator(data.speakers);
      } else if (data.type === 'response') {
        // Add response immediately
        addMessage({
          role: 'assistant',
          persona: data.persona,
          name: data.name,
          emoji: data.emoji,
          color: data.color,
          content: data.content
        });
      } else if (data.type === 'done') {
        hideTypingIndicator();
        eventSource.close();
      }
    };

    eventSource.onerror = (e) => {
      console.error('SSE error:', e);
      hideTypingIndicator();
      eventSource.close();
      addMessage({
        role: 'assistant',
        name: 'System',
        emoji: '⚠️',
        color: '#ff6b6b',
        content: 'Sorry, something went wrong. Please try again.'
      });
    };

  } catch (e) {
    console.error('Chat error:', e);
    hideTypingIndicator();
    addMessage({
      role: 'assistant',
      name: 'System',
      emoji: '⚠️',
      color: '#ff6b6b',
      content: 'Sorry, something went wrong. Please try again.'
    });
  }
}

// Add a message to the chat
function addMessage(msg) {
  const isUser = msg.role === 'user';

  const messageEl = document.createElement('div');
  messageEl.className = `message ${isUser ? 'user' : 'fren'}`;

  if (isUser) {
    messageEl.innerHTML = `
      <div class="message-avatar">You</div>
      <div class="message-content">
        <div class="message-text">${escapeHtml(msg.content)}</div>
      </div>
    `;
  } else {
    messageEl.innerHTML = `
      <div class="message-avatar" style="background: ${msg.color}">${msg.emoji}</div>
      <div class="message-content" style="border-left: 3px solid ${msg.color}">
        <div class="message-header">
          <span class="message-name" style="color: ${msg.color}">${msg.name}</span>
        </div>
        <div class="message-text">${escapeHtml(msg.content)}</div>
      </div>
    `;
  }

  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.id = 'typing-indicator';
  indicator.innerHTML = `
    <div class="typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <span class="typing-text">Frens are thinking...</span>
  `;
  messagesEl.appendChild(indicator);
  scrollToBottom();
}

// Update typing indicator with speaker names
function updateTypingIndicator(speakerIds) {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    const names = speakerIds.map(id => {
      const p = personas.find(p => p.id === id);
      return p ? p.name : id;
    }).join(', ');
    indicator.querySelector('.typing-text').textContent = `${names} thinking...`;
  }
}

// Hide typing indicator
function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

// Clear chat
async function clearChat() {
  try {
    await fetch(`${API_BASE}/api/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });

    // Generate new session
    sessionId = generateSessionId();

    // Clear messages
    messagesEl.innerHTML = `
      <div class="welcome-message">
        <p>Welcome to Claude Frens Chat! 👋</p>
        <p>Type a message and watch different frens respond with their unique perspectives.</p>
        <p>You can @mention specific frens by name (e.g., "@Klaus help me edit this")</p>
      </div>
    `;
  } catch (e) {
    console.error('Clear error:', e);
  }
}

// Scroll to bottom of messages
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start the app
init();
