export const defaultLiveChatPreferences = {
  enabled: true,
  availability: 'Online',
  soundEnabled: true,
  messagePreviews: true,
  enterToSend: true,
}

// Production Live Chat is PostgreSQL-backed. Keep the legacy fallback empty so
// a clean browser or tenant can never manufacture demo conversations.
export const seedLiveChatConversations = []

// Retained only for the non-production legacy prototype path. Canonical
// workspaces and portals never synthesize requester replies.
export const liveChatReplyOptions = [
  'Thanks — I have just tried that and the issue is still happening.',
  'That has worked. I can continue now, thank you!',
  'I can see the change now. Is there anything else I need to do?',
]
