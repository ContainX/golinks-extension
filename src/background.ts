// The service worker.
//
// It owns two things: the short-host redirect rule, which has to match the
// current configuration at all times, and the omnibox keyword. Both are set up
// on every start, because an MV3 worker is torn down whenever the browser
// feels like it.

import { onConfigChanged, readConfig } from './config'
import { registerOmnibox } from './omnibox'
import { syncRedirectRule } from './redirect'

async function refreshRedirectRule(): Promise<void> {
  const config = await readConfig()
  await syncRedirectRule({ baseUrl: config.baseUrl, shortHost: config.shortHost })
}

chrome.runtime.onInstalled.addListener((details) => {
  void refreshRedirectRule()
  // A fresh install has nowhere to point yet; show the member where to say so.
  if (details.reason === 'install') {
    void readConfig().then((config) => {
      if (config.baseUrl === null) void chrome.runtime.openOptionsPage()
    })
  }
})

chrome.runtime.onStartup.addListener(() => {
  void refreshRedirectRule()
})

onConfigChanged(() => {
  void refreshRedirectRule()
})

registerOmnibox({
  readConfig: async () => {
    const config = await readConfig()
    return { baseUrl: config.baseUrl, shortHost: config.shortHost }
  },
  navigate: (url, disposition) => {
    if (disposition === 'newForegroundTab') {
      void chrome.tabs.create({ url, active: true })
    } else if (disposition === 'newBackgroundTab') {
      void chrome.tabs.create({ url, active: false })
    } else {
      void chrome.tabs.update({ url })
    }
  },
})

// The worker may be starting because of a navigation the rule should already
// have caught, so do not wait for an event to install it.
void refreshRedirectRule()
