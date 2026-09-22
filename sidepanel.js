// Propnexaa Outbound Copilot - Side Panel Script

let activeProspect = null;
let activePost = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadSettings();
  await detectActiveTab();

  // Listen for storage changes (e.g. content script discovered new profile or post)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.activeProfileContext?.newValue) {
        updateProspectUI(changes.activeProfileContext.newValue);
      }
      if (changes.activePostContext?.newValue) {
        updatePostUI(changes.activePostContext.newValue);
      }
      if (changes.activeInstagramProfile?.newValue) {
        updateInstagramProfileUI(changes.activeInstagramProfile.newValue);
      }
    }
  });

  // Event Listeners
  document.getElementById('btn-refresh-prospect')?.addEventListener('click', detectActiveTab);
  document.getElementById('btn-refresh-post')?.addEventListener('click', refreshPostContext);
  document.getElementById('btn-generate-outreach')?.addEventListener('click', handleGenerateOutreach);
  document.getElementById('btn-copy-outreach')?.addEventListener('click', () => copyToClipboard('outreach-text', 'btn-copy-outreach'));
  document.getElementById('btn-insert-outreach')?.addEventListener('click', handleInsertOutreach);

  document.getElementById('btn-generate-comment')?.addEventListener('click', handleGenerateComment);
  document.getElementById('btn-copy-comment')?.addEventListener('click', () => copyToClipboard('comment-text', 'btn-copy-comment'));
  document.getElementById('btn-insert-comment')?.addEventListener('click', handleInsertComment);

  document.getElementById('btn-generate-post')?.addEventListener('click', handleGeneratePost);
  document.getElementById('btn-copy-post')?.addEventListener('click', () => copyToClipboard('post-text', 'btn-copy-post'));

  document.getElementById('btn-save-settings')?.addEventListener('click', handleSaveSettings);

  // Character counter for outreach text
  document.getElementById('outreach-text')?.addEventListener('input', updateCharCount);
});

// Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll('.nav-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(`tab-${btn.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });
}

// Detect Active Tab
async function detectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const badge = document.getElementById('platform-badge');

  if (!tab?.url) return;

  if (tab.url.includes('linkedin.com')) {
    badge.className = 'badge badge-linkedin';
    badge.innerText = 'LinkedIn Active';

    // Query content script for profile
    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' }, (res) => {
      if (chrome.runtime.lastError || !res?.profile) {
        // Fallback to storage
        chrome.storage.local.get('activeProfileContext', (data) => {
          if (data.activeProfileContext) updateProspectUI(data.activeProfileContext);
        });
      } else {
        updateProspectUI(res.profile);
      }
    });

  } else if (tab.url.includes('instagram.com')) {
    badge.className = 'badge badge-instagram';
    badge.innerText = 'Instagram Active';

    chrome.tabs.sendMessage(tab.id, { type: 'GET_INSTAGRAM_CONTEXT' }, (res) => {
      if (res?.profile) updateInstagramProfileUI(res.profile);
      if (res?.post) updatePostUI(res.post);
    });

  } else {
    badge.className = 'badge badge-neutral';
    badge.innerText = 'Offline';
  }
}

function updateProspectUI(profile) {
  if (!profile) return;
  activeProspect = profile;

  document.getElementById('prospect-name').innerText = profile.name || 'Unnamed Prospect';
  document.getElementById('prospect-headline').innerText = profile.headline || profile.company || 'Profile detected';
}

function updateInstagramProfileUI(profile) {
  if (!profile) return;
  activeProspect = {
    platform: 'instagram',
    name: profile.fullName || profile.username,
    headline: profile.bio || 'Instagram Real Estate Account',
    company: profile.username
  };

  document.getElementById('prospect-name').innerText = activeProspect.name;
  document.getElementById('prospect-headline').innerText = `@${profile.username} • ${profile.bio || 'Active Profile'}`;
}

function updatePostUI(post) {
  if (!post) return;
  activePost = post;

  document.getElementById('post-author').innerText = `Author: ${post.author || 'Creator'}`;
  document.getElementById('post-snippet').innerText = post.content || post.caption || 'Captured post';
}

async function refreshPostContext() {
  const data = await chrome.storage.local.get(['activePostContext', 'activeInstagramPost']);
  const post = data.activePostContext || data.activeInstagramPost;
  if (post) {
    updatePostUI(post);
  } else {
    alert('Click "✨ AI Comment" on any post in your feed first!');
  }
}

// Gemini API Caller with Fallback
async function callGemini(prompt, isJson = false) {
  const settings = await chrome.storage.local.get(['apiKey']);
  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    throw new Error('Please enter your Gemini API Key in the Settings tab to activate the copilot.');
  }

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6 }
  };

  if (isJson) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  // Primary: gemini-3.5-flash-lite
  let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  let data = await res.json();
  if (data.error) {
    // Fallback: gemini-3.6-flash
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || 'Gemini API Error');
    }
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Outreach Generation Handler (Connection Note / Lavender DM / Instagram)
async function handleGenerateOutreach() {
  const btn = document.getElementById('btn-generate-outreach');
  const type = document.querySelector('input[name="outreach-type"]:checked')?.value || 'connection_note';
  const settings = await chrome.storage.local.get(['senderName', 'companyName', 'offerDescription']);

  const sender = settings.senderName || 'Sourav';
  const company = settings.companyName || 'Propnexaa';
  const offer = settings.offerDescription || 'WhatsApp AI lead routing for Dubai brokers';

  const prospectName = activeProspect?.name || 'there';
  const prospectFirstName = prospectName.split(' ')[0] || 'there';
  const headline = activeProspect?.headline || '';
  const prospectCompany = activeProspect?.company || '';

  btn.disabled = true;
  btn.innerText = '⚡ Crafting with Gemini...';

  try {
    let prompt = '';
    if (type === 'connection_note') {
      prompt = `You are ${sender}, founder of ${company}. Write a personalized LinkedIn Connection Request note to:
Prospect: ${prospectName}
Headline: ${headline}
Company: ${prospectCompany}
Offer Context: ${offer}

RULES (STRICT LINKEDIN CONNECTION RULES):
1. LENGTH: Must be STRICTLY UNDER 280 CHARACTERS total (LinkedIn 300 char hard limit).
2. TONE: Friendly, peer-to-peer. NOT a hard pitch.
3. STRUCTURE:
   - "Hey ${prospectFirstName}, saw your work at ${prospectCompany || 'in Dubai real estate'}."
   - 1 quick line connecting to after-hours lead response or WhatsApp workflows.
   - "Would love to connect!"
4. Return ONLY the raw connection note text without quotes.`;

    } else if (type === 'lavender_dm') {
      prompt = `You are ${sender}, founder of ${company}. Write a high-converting Lavender 40-word LinkedIn InMail/DM to:
Prospect: ${prospectName}
Headline: ${headline}
Company: ${prospectCompany}
Offer Context: ${offer}

LAVENDER 40-WORD DIRECT MESSAGE RULES:
1. STRICT WORD COUNT: 30 to 45 words maximum.
2. FORMATTING: Double line breaks (\\n\\n) between EVERY single sentence.
3. 5th-grade simple English.
4. ONLY ONE QUESTION: The closing ask.
5. Example format:
   Hey ${prospectFirstName},

   Quick question — how are your brokers handling portal leads that come in after 8 PM on Bayut right now?

   We built a simple 15-second WhatsApp flow that pre-qualifies buyers before agents wake up.

   Worth a 60-second look, or totally sorted on this?

   Best,
   ${sender}
6. Return ONLY the raw DM text.`;

    } else {
      // Instagram Story/DM
      prompt = `You are ${sender} reaching out on Instagram to a luxury real estate broker in Dubai.
Target: ${prospectName} (${headline})

RULES:
1. Short, casual, Instagram DM tone (under 30 words).
2. Reference their listings or property reels.
3. Example: "Hey ${prospectFirstName}, loved that recent villa walkthrough you posted. Quick question — do you handle all the WhatsApp inquiries manually or have an automation set up?"
4. Return ONLY the text.`;
    }

    const output = await callGemini(prompt, false);
    const textarea = document.getElementById('outreach-text');
    textarea.value = output.trim();
    document.getElementById('outreach-output-box').classList.remove('hidden');
    updateCharCount();

  } catch (err) {
    alert('Error generating outreach: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '✨ Generate Tailored Message';
  }
}

// Insert Outreach Note directly into LinkedIn page
async function handleInsertOutreach() {
  const text = document.getElementById('outreach-text').value;
  if (!text) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: 'INSERT_NOTE_TEXT', text }, (res) => {
    // If not in modal, copy to clipboard as fallback
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard! (If Connection Modal is open on LinkedIn, paste it directly with Ctrl+V)');
  });
}

// Smart Comment Generator
async function handleGenerateComment() {
  const btn = document.getElementById('btn-generate-comment');
  const angle = document.getElementById('comment-angle').value;
  const post = activePost;

  if (!post || !post.content) {
    alert('Please click "✨ AI Comment" on a LinkedIn or Instagram post first!');
    return;
  }

  btn.disabled = true;
  btn.innerText = '⚡ Generating insight...';

  try {
    const prompt = `You are a savvy Dubai real estate tech founder reading a post on social media.
Post Author: ${post.author}
Post Content: "${post.content.slice(0, 800)}"
Selected Style: ${angle}

COMMENT RULES:
1. LENGTH: 1 to 3 short sentences max.
2. TONE: Peer-to-peer, insightful, authentic.
3. BANNED: Never say "Great post!", "Insightful read!", or bot-like cheerleading.
4. If "thoughtful_insight": add an observant perspective on Dubai buyers, speed to lead, or market shifts.
5. If "curious_question": ask a sharp, intelligent follow-up question.
6. If "short_punchy": 1 snappy observation.
Return ONLY the comment text without quotation marks.`;

    const comment = await callGemini(prompt, false);
    document.getElementById('comment-text').value = comment.trim();
    document.getElementById('comment-output-box').classList.remove('hidden');

  } catch (err) {
    alert('Error generating comment: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '✨ Generate Smart Comment';
  }
}

// Insert Comment directly into LinkedIn comment box
async function handleInsertComment() {
  const text = document.getElementById('comment-text').value;
  if (!text) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: 'INSERT_COMMENT_TEXT', text }, (res) => {
    if (res?.success) {
      alert('Comment inserted directly into LinkedIn comment box!');
    } else {
      navigator.clipboard.writeText(text);
      alert('Copied to clipboard! Click inside the LinkedIn comment box and press Ctrl+V.');
    }
  });
}

// Viral Post Generator
async function handleGeneratePost() {
  const btn = document.getElementById('btn-generate-post');
  const topic = document.getElementById('post-topic').value || 'Why Dubai brokers lose 60% of portal leads after 8 PM';
  const style = document.getElementById('post-style').value;

  btn.disabled = true;
  btn.innerText = '🚀 Drafting post...';

  try {
    const prompt = `Write a viral LinkedIn thought leadership post for Dubai real estate brokers.
Topic: "${topic}"
Style: ${style}

FORMATTING & HOOK RULES:
1. HOOK: First line must be a pattern-interrupt scroll-stopper (e.g. "Most Dubai brokers lose 60% of their commission between 8 PM and 7 AM.").
2. SPACING: Double line breaks between every thought. Ultra-readable on mobile.
3. STORY & LESSON: Break down why speed to lead on Bayut/Property Finder makes or breaks off-plan deals.
4. SOFT CALL TO ACTION: A conversational closing ask (e.g. "How is your agency managing after-hours WhatsApp inquiries right now?").
5. NO generic hashtags. Max 3 relevant ones (#DubaiRealEstate #Proptech #LeadConversion).

Return ONLY the raw post text.`;

    const post = await callGemini(prompt, false);
    document.getElementById('post-text').value = post.trim();
    document.getElementById('post-output-box').classList.remove('hidden');

  } catch (err) {
    alert('Error drafting post: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = '🚀 Draft Viral LinkedIn Post';
  }
}

// Helper: Copy text
function copyToClipboard(elementId, btnId) {
  const text = document.getElementById(elementId)?.value;
  if (!text) return;
  navigator.clipboard.writeText(text);

  const btn = document.getElementById(btnId);
  const original = btn.innerText;
  btn.innerText = '✅ Copied!';
  setTimeout(() => { btn.innerText = original; }, 2000);
}

// Helper: Character counter
function updateCharCount() {
  const text = document.getElementById('outreach-text')?.value || '';
  const counter = document.getElementById('char-count');
  if (counter) {
    counter.innerText = `${text.length} / 300 chars`;
    if (text.length > 300) {
      counter.style.color = '#ef4444';
    } else {
      counter.style.color = '#38bdf8';
    }
  }
}

// Settings Handlers
async function loadSettings() {
  const data = await chrome.storage.local.get([
    'apiKey', 'senderName', 'companyName', 'offerDescription'
  ]);

  if (data.apiKey) document.getElementById('setting-api-key').value = data.apiKey;
  if (data.senderName) document.getElementById('setting-sender-name').value = data.senderName;
  if (data.companyName) document.getElementById('setting-company-name').value = data.companyName;
  if (data.offerDescription) document.getElementById('setting-offer').value = data.offerDescription;
}

async function handleSaveSettings() {
  const apiKey = document.getElementById('setting-api-key').value.trim();
  const senderName = document.getElementById('setting-sender-name').value.trim();
  const companyName = document.getElementById('setting-company-name').value.trim();
  const offerDescription = document.getElementById('setting-offer').value.trim();

  await chrome.storage.local.set({
    apiKey,
    senderName,
    companyName,
    offerDescription
  });

  const status = document.getElementById('save-status');
  status.classList.remove('hidden');
  setTimeout(() => status.classList.add('hidden'), 2500);
}
