import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const telegramAuth = fs.readFileSync("app/components/TelegramMiniAppAuth.tsx", "utf8");
const newListing = fs.readFileSync("app/listings/new/page.tsx", "utf8");

test("I3: Telegram identity must win over a stale stored Supabase session", () => {
  // Regression contract for the concrete race documented in PR #273:
  // a Telegram auth request may still be pending while /listings/new calls
  // getUser() and reads the browser's previous session.
  //
  // The fix must introduce one shared readiness barrier. This test intentionally
  // fails on main because no such barrier exists yet.
  assert.match(
    telegramAuth,
    /__ROYALHOUSE_TELEGRAM_AUTH_READY__|AuthGate|telegramAuthReady/i,
    "Telegram auth must expose a shared readiness barrier before pages read getUser()",
  );

  assert.match(
    newListing,
    /__ROYALHOUSE_TELEGRAM_AUTH_READY__|AuthGate|awaitTelegramAuth|telegramAuthReady/i,
    "E'lon joylash must await Telegram auth before calling supabase.auth.getUser()",
  );
});
