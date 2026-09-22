// Propnexaa Outbound Copilot - Service Worker (Manifest V3)

// Configure side panel to open immediately upon clicking the extension icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('SidePanel behavior error:', error));

// Set default settings on install if not present
chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    apiKey: '',
    senderName: 'Sourav',
    companyName: 'Propnexaa',
    offerDescription: '15-second WhatsApp AI lead response & automated CRM routing for Dubai brokers',
    tone: 'casual_peer'
  };

  const current = await chrome.storage.local.get(Object.keys(defaults));
  const toSet = {};
  for (const [key, val] of Object.entries(defaults)) {
    if (current[key] === undefined) toSet[key] = val;
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }
});

// Relay messages between content scripts and side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SCRAPED_DATA_BROADCAST') {
    // Forward scraped LinkedIn/Instagram context to open sidepanel
    chrome.runtime.sendMessage(request).catch(() => {});
    sendResponse({ received: true });
    return false;
  }

  if (request.type === 'EXECUTE_ACTION_IN_TAB') {
    // Forward action to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, request, (res) => {
          sendResponse(res);
        });
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true; // async response
  }
});
