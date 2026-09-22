// Propnexaa Outbound Copilot - Instagram Content Script

function scrapeInstagramProfile() {
  const path = window.location.pathname.replace(/^\/|\/$/g, '');
  if (!path || path.includes('direct') || path.includes('explore') || path.includes('reels') || path.includes('stories')) {
    return null;
  }

  const usernameEl = document.querySelector('header h2') || document.querySelector('header h1');
  const bioEl = document.querySelector('header section div:nth-child(3)') || document.querySelector('header .-vDIg');
  const fullNameEl = document.querySelector('header section span');

  const username = usernameEl?.innerText?.trim() || path;
  const bio = bioEl?.innerText?.trim() || '';
  const fullName = fullNameEl?.innerText?.trim() || username;

  return {
    platform: 'instagram',
    type: 'profile',
    username,
    fullName,
    bio: bio.slice(0, 400),
    url: window.location.href
  };
}

// Scrape active post or reel modal
function scrapeInstagramPost() {
  const modal = document.querySelector('article[role="presentation"]') || document.querySelector('article');
  if (!modal) return null;

  const captionEl = modal.querySelector('h1') || modal.querySelector('span._aacl');
  const authorEl = modal.querySelector('header a');

  return {
    platform: 'instagram',
    type: 'post',
    author: authorEl?.innerText?.trim() || 'Agent',
    caption: captionEl?.innerText?.trim() || ''
  };
}

// Observe DOM
const observer = new MutationObserver(() => {
  const profile = scrapeInstagramProfile();
  if (profile) {
    chrome.storage.local.set({ activeInstagramProfile: profile });
  }

  const post = scrapeInstagramPost();
  if (post) {
    chrome.storage.local.set({ activeInstagramPost: post });
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_INSTAGRAM_CONTEXT') {
    const profile = scrapeInstagramProfile();
    const post = scrapeInstagramPost();
    sendResponse({ profile, post });
    return false;
  }
});
