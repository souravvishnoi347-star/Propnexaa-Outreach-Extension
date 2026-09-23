// Propnexaa Outbound Copilot - Side Panel Script v1.1
// Uses direct DOM inspection via chrome.scripting for 100% reliable context capture

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadSettings();
  
  // Auto-scan page immediately on sidepanel open
  await scanActivePageDirect();

  // Button Listeners
  document.getElementById('btn-scan-page')?.addEventListener('click', scanActivePageDirect);
  document.getElementById('btn-generate-outreach')?.addEventListener('click', handleGenerateOutreach);
  document.getElementById('btn-copy-outreach')?.addEventListener('click', () => copyToClipboard('outreach-text', 'btn-copy-outreach'));
  document.getElementById('btn-insert-outreach')?.addEventListener('click', handleInsertOutreach);

  document.getElementById('btn-generate-comment')?.addEventListener('click', handleGenerateComment);
  document.getElementById('btn-copy-comment')?.addEventListener('click', () => copyToClipboard('comment-text', 'btn-copy-comment'));
  document.getElementById('btn-insert-comment')?.addEventListener('click', handleInsertComment);

  document.getElementById('btn-generate-post')?.addEventListener('click', handleGeneratePost);
  document.getElementById('btn-copy-post')?.addEventListener('click', () => copyToClipboard('post-text', 'btn-copy-post'));

  document.getElementById('btn-save-settings')?.addEventListener('click', handleSaveSettings);
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

// Direct DOM Inspection via chrome.scripting (Rock-Solid Fallback & Real-Time Scraper)
async function scanActivePageDirect() {
  const statusEl = document.getElementById('scan-status');
  const badgeEl = document.getElementById('platform-badge');
  if (statusEl) statusEl.innerText = 'Scanning active page...';

  // Smart Tab Query: Always find the active web tab, ignoring extension sidepanels
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let tab = tabs.find(t => t.active && !t.url?.startsWith('chrome-extension://')) ||
            tabs.find(t => t.url && (t.url.includes('linkedin.com') || t.url.includes('instagram.com'))) ||
            tabs[0];

  if (!tab?.id || !tab.url) {
    if (statusEl) statusEl.innerText = 'No active tab detected';
    return;
  }

  // Check platform
  if (tab.url.includes('linkedin.com')) {
    badgeEl.className = 'badge badge-linkedin';
    badgeEl.innerText = 'LinkedIn';
  } else if (tab.url.includes('instagram.com')) {
    badgeEl.className = 'badge badge-instagram';
    badgeEl.innerText = 'Instagram';
  } else {
    badgeEl.className = 'badge badge-neutral';
    badgeEl.innerText = 'Web';
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const isLinkedIn = window.location.hostname.includes('linkedin.com');
        const isInstagram = window.location.hostname.includes('instagram.com');

        // 1. LinkedIn Scraper
        if (isLinkedIn) {
          let name = '';

          // Method A: document.title (100% reliable on LinkedIn profiles)
          // e.g. "(6) Oren Dmitrishin | LinkedIn" or "Oren Dmitrishin - Real Estate Broker | LinkedIn"
          if (document.title && document.title.includes('LinkedIn')) {
            const cleanTitle = document.title
              .replace(/^\(\d+\)\s*/, '') // remove notifications like (6)
              .replace(/\s*\|\s*LinkedIn.*$/i, '')
              .replace(/\s*-\s*LinkedIn.*$/i, '')
              .trim();
            const parts = cleanTitle.split(/[-–—|]/);
            const firstPart = parts[0]?.trim();
            if (firstPart && firstPart.length > 1 && !firstPart.includes('Feed') && !firstPart.includes('Search') && !firstPart.includes('Messaging') && !firstPart.includes('Notifications')) {
              name = firstPart;
            }
          }

          // Method B: DOM H1 Elements
          if (!name) {
            const h1Elements = Array.from(document.querySelectorAll('h1'));
            for (const el of h1Elements) {
              const clone = el.cloneNode(true);
              clone.querySelectorAll('.visually-hidden, button, span[class*="badge"], span[class*="dist-value"], svg').forEach(n => n.remove());
              const t = (clone.innerText || clone.textContent || '').trim().split('\n')[0];
              if (t && t.length > 2 && !t.includes('LinkedIn') && !t.includes('Feed') && !t.includes('Search')) {
                name = t;
                break;
              }
            }
          }

          // Headline Extraction
          let headline = '';
          const topCard = document.querySelector('section.artdeco-card') || 
                          document.querySelector('main section:first-of-type') || 
                          document.querySelector('.pv-top-card') ||
                          document.body;

          if (topCard) {
            const textElements = Array.from(topCard.querySelectorAll('.text-body-medium, div[class*="headline"], div[data-generated-suggestion-target], .pv-top-card-section__headline'));
            for (const el of textElements) {
              const t = el.innerText?.trim();
              if (t && t.length > 3 && t !== name && !t.includes('connections') && !t.includes('Contact info')) {
                headline = t.split('\n')[0].trim();
                break;
              }
            }

            // Fallback: search divs for real estate/role keywords
            if (!headline) {
              const divs = Array.from(topCard.querySelectorAll('div'));
              for (const d of divs) {
                const t = d.innerText?.trim();
                if (t && t.length > 5 && t.length < 150 && t !== name && !t.includes('connections') && !t.includes('Contact info') && !t.includes('mutual')) {
                  if (t.toLowerCase().includes('broker') || t.toLowerCase().includes('estate') || t.toLowerCase().includes('founder') || t.toLowerCase().includes('ceo') || t.toLowerCase().includes('agent') || t.toLowerCase().includes('manager') || t.toLowerCase().includes('at ')) {
                    headline = t.split('\n')[0].trim();
                    break;
                  }
                }
              }
            }
          }

          // Company Extraction (e.g. from "Broker at ThriveState")
          let company = '';
          if (headline && /\bat\b|\b@\b/i.test(headline)) {
            const match = headline.match(/\b(?:at|@)\s+([^,|•\n]+)/i);
            if (match && match[1]) {
              company = match[1].trim();
            }
          }
          if (!company) {
            const companySelectors = [
              '.pv-text-details__right-panel button span',
              'button[aria-label*="Current company"]',
              'div[aria-label="Current company"]',
              '.experience-item .t-bold span',
              '#experience ~ div ul li:first-child .t-bold span'
            ];
            for (const sel of companySelectors) {
              const el = document.querySelector(sel);
              const t = el?.innerText?.trim()?.split('\n')[0];
              if (t && t.length > 1) {
                company = t;
                break;
              }
            }
          }

          // Visible Feed Post (Center-weighted viewport detection)
          let post = null;
          const allPosts = Array.from(document.querySelectorAll('.feed-shared-update-v2, div[data-urn*="activity"], div.occludable-update, article, div[data-id*="urn:li:activity"]'));
          let bestPost = null;
          let minDistance = Infinity;
          const centerY = window.innerHeight / 2;

          for (const p of allPosts) {
            const rect = p.getBoundingClientRect();
            if (rect.height > 60 && rect.bottom > 50 && rect.top < window.innerHeight) {
              const dist = Math.abs((rect.top + rect.height / 2) - centerY);
              if (dist < minDistance) {
                minDistance = dist;
                bestPost = p;
              }
            }
          }

          if (!bestPost && allPosts.length > 0) bestPost = allPosts[0];

          if (bestPost) {
            const authorEl = bestPost.querySelector('.update-components-actor__name, .feed-shared-actor__name, span[dir="ltr"], strong');
            const textEl = bestPost.querySelector('.feed-shared-update-v2__description, .update-components-text, .feed-shared-text, div[dir="ltr"]');
            if (textEl && textEl.innerText.trim().length > 10) {
              post = {
                author: authorEl?.innerText?.split('\n')[0]?.trim() || 'Author',
                content: textEl.innerText.trim()
              };
            }
          }

          return { platform: 'linkedin', name, headline, company, post };
        }

        // 2. Instagram Scraper
        if (isInstagram) {
          const usernameEl = document.querySelector('header h2') || document.querySelector('header h1');
          const bioEl = document.querySelector('header section div:nth-child(3)') || document.querySelector('header .-vDIg');
          const username = usernameEl?.innerText?.trim() || window.location.pathname.replace(/\//g, '');
          const bio = bioEl?.innerText?.trim() || '';

          const article = document.querySelector('article');
          const captionEl = article?.querySelector('h1, span._aacl');
          const authorEl = article?.querySelector('header a');
          const post = captionEl ? { author: authorEl?.innerText?.trim() || username, content: captionEl.innerText.trim() } : null;

          return { platform: 'instagram', name: username, headline: bio, company: username, post };
        }

        return { platform: 'other' };
      }
    });

    const data = results?.[0]?.result;
    if (data) {
      let capturedItems = [];

      // Update Prospect info
      if (data.name) {
        document.getElementById('input-prospect-name').value = data.name;
        capturedItems.push(data.name);
      }
      if (data.headline || data.company) {
        const fullCompany = [data.company, data.headline].filter(Boolean).join(' • ');
        document.getElementById('input-prospect-company').value = fullCompany;
      }
      if (data.name) {
        const captureBadge = document.getElementById('capture-badge');
        if (captureBadge) {
          captureBadge.className = 'pill-badge pill-success';
          captureBadge.innerText = 'Captured';
        }
      }

      // Update Post info
      if (data.post) {
        document.getElementById('input-post-author').value = data.post.author;
        document.getElementById('input-post-content').value = data.post.content;
        capturedItems.push('Active Post');

        const postBadge = document.getElementById('post-capture-badge');
        if (postBadge) {
          postBadge.className = 'pill-badge pill-success';
          postBadge.innerText = 'Captured';
        }
      }

      if (capturedItems.length > 0) {
        statusEl.innerText = `✅ Captured: ${capturedItems.join(' & ')}`;
      } else {
        statusEl.innerText = 'No profile/post detected (Type manually below)';
      }
    }
  } catch (err) {
    console.error('Scan error:', err);
    statusEl.innerText = 'Tip: Refresh the LinkedIn/Instagram tab once';
  }
}

// Gemini API Caller with Fallback
async function callGemini(prompt, isJson = false) {
  const settings = await chrome.storage.local.get(['apiKey']);
  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    throw new Error('Please enter your Gemini API Key in the Settings tab (⚙️) to activate the copilot.');
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

  const prospectName = document.getElementById('input-prospect-name')?.value?.trim() || 'there';
  const prospectFirstName = prospectName.split(' ')[0] || 'there';
  const prospectCompany = document.getElementById('input-prospect-company')?.value?.trim() || '';

  btn.disabled = true;
  btn.innerText = '⚡ Crafting with Gemini...';

  try {
    let prompt = '';
    if (type === 'connection_note') {
      prompt = `You are ${sender}, founder of ${company}. Write a personalized LinkedIn Connection Request note to:
Prospect: ${prospectName}
Details: ${prospectCompany}
Offer Context: ${offer}

RULES (STRICT LINKEDIN CONNECTION RULES):
1. LENGTH: Must be STRICTLY UNDER 270 CHARACTERS total (LinkedIn 300 char hard limit).
2. TONE: Friendly, peer-to-peer. NOT a hard pitch.
3. STRUCTURE:
   - "Hey ${prospectFirstName}, saw your work at ${prospectCompany || 'in Dubai real estate'}."
   - 1 quick line referencing after-hours lead speed or WhatsApp response.
   - "Would love to connect!"
4. Return ONLY the raw connection note text without quotes.`;

    } else if (type === 'lavender_dm') {
      prompt = `You are ${sender}, founder of ${company}. Write a high-converting Lavender 40-word LinkedIn InMail/DM to:
Prospect: ${prospectName}
Details: ${prospectCompany}
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
Target: ${prospectName} (${prospectCompany})

RULES:
1. Short, casual, Instagram DM tone (under 30 words).
2. Reference their listings or property walkthroughs.
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

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [text],
      func: (noteText) => {
        // Look for connection note textarea
        const textarea = document.querySelector('textarea#custom-message') ||
                         document.querySelector('.send-invite textarea') ||
                         document.querySelector('textarea[name="message"]') ||
                         document.querySelector('textarea');
        if (textarea) {
          textarea.value = noteText;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }
    });

    navigator.clipboard.writeText(text);
    alert('Copied to clipboard & auto-inserted into open connection modal!');
  } catch (err) {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard! (Press Ctrl+V to paste)');
  }
}

// Smart Comment Generator
async function handleGenerateComment() {
  const btn = document.getElementById('btn-generate-comment');
  const angle = document.getElementById('comment-angle').value;
  const author = document.getElementById('input-post-author')?.value || 'Author';
  const content = document.getElementById('input-post-content')?.value || '';

  if (!content) {
    alert('Please enter or scan a post first! Click "1-Click Scan Active Page" while viewing a post.');
    return;
  }

  btn.disabled = true;
  btn.innerText = '⚡ Generating insight...';

  try {
    const prompt = `You are a savvy Dubai real estate tech founder reading a post on social media.
Post Author: ${author}
Post Content: "${content.slice(0, 800)}"
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

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [text],
      func: (commentText) => {
        const commentBox = document.querySelector('.ql-editor[contenteditable="true"]') ||
                           document.querySelector('textarea[aria-label*="Add a comment"]') ||
                           document.querySelector('.comments-comment-box__editor .ql-editor');
        if (commentBox) {
          if (commentBox.isContentEditable) {
            commentBox.innerText = commentText;
            commentBox.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            commentBox.value = commentText;
            commentBox.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return true;
        }
        return false;
      }
    });

    navigator.clipboard.writeText(text);
    if (results?.[0]?.result) {
      alert('Comment inserted directly into LinkedIn comment box!');
    } else {
      alert('Copied to clipboard! Click inside the LinkedIn comment box and press Ctrl+V.');
    }
  } catch (err) {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard! Click inside the LinkedIn comment box and press Ctrl+V.');
  }
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
    if (text.length > 270) {
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
