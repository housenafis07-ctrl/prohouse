# Telegram auth flow

Telegram identity is canonical inside the Mini App when a Telegram user already has a Royalhouse profile link. Phone verification is fallback only when no Telegram-to-profile link exists.

The login route must also verify that the deterministic Telegram auth identity belongs to the linked profile before returning a session; a stale identity belonging to another profile must never be used.
