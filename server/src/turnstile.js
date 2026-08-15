/**
 * Turnstile (catraca) integration point.
 *
 * This is a pluggable interface, not the real driver — no physical turnstile
 * is connected in this prototype. Swap the body of `releasePassage` for a real
 * integration when hardware is chosen. The three common ways Brazilian
 * turnstile controllers (Topdata, Henry, Control iD, etc.) accept a release
 * command:
 *
 *   1. Dry-contact relay: pulse a GPIO/relay pin wired to the controller's
 *      "liberar" input (needs a relay board on the kiosk device).
 *   2. Local network command: the controller exposes a small TCP/HTTP API on
 *      the LAN (e.g. `POST http://<catraca-ip>/liberar`).
 *   3. Serial (RS-232/RS-485): send a vendor-specific byte sequence over a
 *      serial port.
 *
 * Whichever it ends up being, the call site (server/src/index.js) does not
 * change — only this file does.
 */

async function releasePassage({ gateId = "default", employeeId, mealType }) {
  // --- MOCK IMPLEMENTATION ---
  // Simulates the ~400ms it takes a real relay/network round-trip to fire.
  await new Promise((resolve) => setTimeout(resolve, 400));

  console.log(
    `[catraca:${gateId}] passagem liberada — funcionário #${employeeId}, refeição: ${mealType}`
  );

  return { released: true, gateId, at: new Date().toISOString() };
}

module.exports = { releasePassage };
