// Propnexaa Outbound Copilot - LinkedIn Content Script

function scrapeProfile() {
  if (!window.location.pathname.includes('/in/')) return null;

  const nameEl = document.querySelector('h1.text-heading-xlarge') || document.querySelector('h1');
  const headlineEl = document.querySelector('.text-body-medium.break-words') || document.querySelector('[data-generated-suggestion-target]');
  const companyEl = document.querySelector('.pv-text-details__right-panel button span') || document.querySelector('.experience-item');
  const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words');
  const aboutEl = document.querySelector('#about ~ div .visually-hidden') || document.querySelector('#about ~ div span[aria-hidden="true"]');

  const name = nameEl?.innerText?.trim() || '';
  const headline = headlineEl?.innerText?.trim() || '';
  const company = companyEl?.innerText?.trim() || '';
  const location = locationEl?.innerText?.trim() || '';
  const about = aboutEl?.innerText?.trim() || '';

  if (!name) return null;

  return {
    platform: 'linkedin',
    type: 'profile',
    url: window.location.href,
    name,
    headline,
    company,
    location,
    about: about.slice(0, 500)
  };
}

// Injects "✨ AI Comment" button into LinkedIn feed posts
function injectFeedCommentButtons() {
  const actionBars = document.querySelectorAll('.feed-shared-social-action-bar:not([data-propnexaa-ready])');
  
  actionBars.forEach(bar => {
    bar.setAttribute('data-propnexaa-ready', 'true');
    
    const btn = document.createElement('button');
    btn.className = 'propnexaa-inline-btn';
    btn.innerHTML = '<span class="propnexaa-sparkle-icon">✨</span> AI Comment';
    btn.title = 'Generate smart contextual comment with Propnexaa AI';
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const postCard = bar.closest('.feed-shared-update-v2') || bar.closest('.occludable-update');
      const authorEl = postCard?.querySelector('.update-components-actor__name') || postCard?.querySelector('.feed-shared-actor__name');
      const textEl = postCard?.querySelector('.feed-shared-update-v2__description') || postCard?.querySelector('.update-components-text');
      
      const postData = {
        platform: 'linkedin',
        type: 'post',
        author: authorEl?.innerText?.split('\n')[0]?.trim() || 'Author',
        content: textEl?.innerText?.trim() || ''
      };

      // Store in storage so sidepanel reads it immediately
      chrome.storage.local.set({ activePostContext: postData }, () => {
        chrome.runtime.sendMessage({
          type: 'SCRAPED_DATA_BROADCAST',
          data: postData
        });
      });

      // Also trigger comment box open on LinkedIn
      const commentToggle = bar.querySelector('button.comment-button') || bar.querySelector('button[aria-label*="Comment"]');
      if (commentToggle) commentToggle.click();
    });

    bar.appendChild(btn);
  });
}

// Injects "✨ Auto-Draft Note" into Connection Request modal
function injectConnectionNoteHelper() {
  const modal = document.querySelector('.send-invite') || document.querySelector('[aria-labelledby="send-invite-modal"]');
  if (!modal || modal.getAttribute('data-propnexaa-ready')) return;

  modal.setAttribute('data-propnexaa-ready', 'true');
  const textarea = modal.querySelector('textarea#custom-message') || modal.querySelector('textarea');
  if (!textarea) return;

  const btn = document.createElement('button');
  btn.className = 'propnexaa-inline-btn';
  btn.style.marginBottom = '8px';
  btn.innerHTML = '<span class="propnexaa-sparkle-icon">✨</span> Auto-Draft Personalized Note';

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    btn.innerHTML = '<span class="propnexaa-sparkle-icon">⏳</span> Drafting note...';

    const profile = scrapeProfile() || (await chrome.storage.local.get('activeProfileContext'))?.activeProfileContext;
    
    chrome.runtime.sendMessage({
      type: 'GENERATE_NOTE_DIRECT',
      profile: profile
    }, (response) => {
      if (response?.note) {
        textarea.value = response.note;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        btn.innerHTML = '<span class="propnexaa-sparkle-icon">✅</span> Note Inserted!';
        setTimeout(() => { btn.innerHTML = '<span class="propnexaa-sparkle-icon">✨</span> Re-Draft Note'; }, 3000);
      } else {
        btn.innerHTML = '<span class="propnexaa-sparkle-icon">❌</span> Check Side Panel';
      }
    });
  });

  textarea.parentNode?.insertBefore(btn, textarea);
}

// Observe DOM updates for single-page app navigation
const observer = new MutationObserver(() => {
  injectFeedCommentButtons();
  injectConnectionNoteHelper();

  // If on profile page, broadcast context
  const profile = scrapeProfile();
  if (profile) {
    chrome.storage.local.set({ activeProfileContext: profile });
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for direct fill commands from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PAGE_CONTEXT') {
    const profile = scrapeProfile();
    sendResponse({ profile });
    return false;
  }

  if (request.type === 'INSERT_COMMENT_TEXT') {
    // Look for active open comment textarea
    const commentBox = document.activeElement?.closest('.feed-shared-update-v2')?.querySelector('.ql-editor') ||
                       document.querySelector('.ql-editor[contenteditable="true"]') ||
                       document.querySelector('textarea[aria-label*="Add a comment"]') ||
                       document.querySelector('.comments-comment-box__editor .ql-editor');
    
    if (commentBox) {
      if (commentBox.isContentEditable) {
        commentBox.innerText = request.text;
        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        commentBox.value = request.text;
        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Please click inside the comment box on LinkedIn first!' });
    }
    return false;
  }
});
