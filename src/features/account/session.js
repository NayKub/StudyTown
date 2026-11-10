// Who is logged in and what we know about their friends. Shared by the account modules.

export const emptySocial = () => ({ incoming: [], outgoing: [], friends: [] });

export const session = {
  /** { uid, email, name, verified, code } or null for a guest */
  user: null,
  /** live friend requests and friends (with their public stats) */
  social: emptySocial(),
  /** supplied by main.js: { getState, replaceState(merged), stats(), visit(friend), onFriendsChange() } */
  hooks: null,
};
