# AgroSense — Pump & Valve Control Test Guide

**For:** Anyone who wants to verify that the pump relay works before connecting a real motor
**Level:** High school — no electronics experience assumed
**DO NOT** connect mains voltage or a motor until all software + relay steps pass

---

## What This Guide Tests

Software path → WebSocket → ESP8266 → Relay module → (then, if all above pass) → Physical pump

We test each layer in order so we know exactly where a problem is if something fails.

---

## Before You Start — Safety Rules

1. **NEVER connect mains/wall-outlet power to the relay while testing software.**
2. **NEVER power a motor from an ESP GPIO pin.** GPIO pins supply only ~12 mA.
   Motors need their own separate power supply (battery pack, motor driver, etc.)
3. **The relay module is safe to test dry** (no load connected to COM/NO/NC)
   while it is powered only from the ESP 5V/VIN rail.
4. Read all steps before touching the hardware.

---

## What You Need

| Item | Purpose |
|---|---|
| NodeMCU 1.0 (ESP-12E) | The microcontroller |
| Relay module (1-channel or 2-channel) | Switches the pump/valve circuit |
| USB cable (micro USB) | Power + Serial Monitor |
| A computer with Arduino IDE or VS Code + PlatformIO | Upload + monitor |
| AgroSense React dashboard | Frontend |
| Optional: multimeter or LED tester | Verify relay switching without a motor |

---

## STEP 1 — Power the ESP with the pump DISCONNECTED

Connect the NodeMCU to your computer via USB.
Do NOT connect any motor, pump, or valve to the relay at this stage.

The relay module COM/NO/NC terminals must be empty (nothing wired to them).

You CAN have the relay IN1/IN2 wired to D1/D2 — that is correct and needed.

---

## STEP 2 — Open Serial Monitor

In Arduino IDE:
  Tools → Serial Monitor → Baud rate: 115200

Or in VS Code / PlatformIO:
  Use the Serial Monitor panel at 115200 baud.

You should see the boot banner:
`
================================================
 AgroSense SIH25015
 ESP8266 Gateway
 Firmware: AgroSense-ESP-v2.1
================================================

[INIT] Hardware Configuration:
[INIT]   Board      : NodeMCU 1.0 (ESP-12E)
[INIT]   Soil Sensor: A0 — REAL physical resistive probe
[INIT]   Temperature: UNAVAILABLE — no DHT/DS18B20/BME280 connected
...
`

If you see garbage characters → wrong baud rate (try 115200).
If you see nothing → wrong COM port selected.

---

## STEP 3 — Connect the Frontend

Open the AgroSense dashboard in your browser.

The top status badge should show:
  GREEN dot  LOCAL ESP

If it shows DISCONNECTED:
  → Click the badge → click "Reconnect"
  → Or enter the ESP IP shown in Serial Monitor

On the right panel you should see:
  "Hardware Control"
  [ Pump ]  STANDBY     [ Start Pump ]
  [ Valve ] CLOSED      [ Open Valve ]

> Note: If the connection fails, the buttons will be greyed out (disabled).
> The pump cannot be commanded while disconnected — this is intentional safety behavior.

---

## STEP 4 — Click "Start Pump"

Click the **Start Pump** button.

The button should immediately show:
  "Command in progress…" (with a spinning indicator)

Then within 1–2 seconds:
  "Stop Pump"  (button turns red/destructive style)
  Pump status shows: ACTIVE

The command pipeline strip below the button should show:
  ✓  Hardware confirmed

---

## STEP 5 — Check Serial Monitor (Software Verification)

In Serial Monitor you should see these lines in order:

`
──────────────────────────────────────────────────────────
[COMMAND] 📥 Received  cmdId=cmd_pump_1234567890  target=pump    action=start
[COMMAND] 📡 Phase 1 — ACK sent to client #0
[PUMP] Command received : ON
[PUMP] GPIO            : D1 / GPIO5  → LOW (relay coil energised)
[PUMP] Relay state     : ACTIVE  (IN1 = LOW, coil ON, COM→NO closed)
[COMMAND] ✅ Phase 3 — CONFIRMED broadcast to all clients
[COMMAND]    Payload: {"type":"confirmed","cmdId":"cmd_pump_...","target":"pump","action":"start","status":"confirmed","pumpActive":true,"valveOpen":false}
──────────────────────────────────────────────────────────
`

If you see all of the above:
  SOFTWARE PATH VERIFIED ✅

If the [COMMAND] line does not appear:
  → WebSocket command did not reach ESP
  → Check your network connection, try manual IP entry

---

## STEP 6 — Check the Relay Module (Relay Verification)

Look at the relay module physically.

When pump is ON (after Step 4):
  - The relay LED (if present) should be LIT
  - You should hear a faint "click" sound from the relay coil
  - If you have a multimeter: measure continuity between COM and NO → should be CLOSED (connected)
  - If you have an LED tester: wire LED+resistor from COM to NO → LED should be ON

If the LED is NOT lit and you hear no click:
  → Check that D1 (not D0, not D2) is connected to relay IN1
  → Check the relay module VCC is connected to NodeMCU VIN or 5V (not 3.3V for most modules)
  → Check GND is shared between relay and NodeMCU

---

## STEP 7 — Click "Stop Pump"

Click the **Stop Pump** button.

The button should return to:
  "Start Pump"  (outline style)
  Pump status shows: STANDBY

Serial Monitor should show:

`
[PUMP] Command received : OFF
[PUMP] GPIO            : D1 / GPIO5  → HIGH (relay coil de-energised)
[PUMP] Relay state     : INACTIVE (IN1 = HIGH, coil OFF, COM→NC closed)
`

---

## STEP 8 — Check the Relay Again

When pump is OFF (after Step 7):
  - The relay LED should be OFF
  - You should hear a faint "click" as the coil releases
  - Multimeter: continuity between COM and NO → OPEN (disconnected)
  - LED tester: LED should be OFF

If Step 6 and Step 8 both pass:
  RELAY VERIFIED ✅

---

## STEP 9 — Valve Test (same procedure)

Repeat Steps 4–8 for the Valve:
  - Click "Open Valve" → check Serial Monitor for [VALVE] lines → check relay IN2 / D2
  - Click "Close Valve" → verify relay releases

---

## STEP 10 — Safety Restart Test

Unplug the USB cable (simulates ESP restart or power cut).
Plug it back in.

The relay LEDs should be OFF immediately at boot — both relays must start in the OFF/safe state.
Serial Monitor will show:
`
[INIT] GPIO initialized — all relays OFF, LED OFF
`

If a relay is ON at boot → wiring error. Check RELAY_ON/RELAY_OFF polarity in firmware.

---

## STEP 11 — Disconnect WebSocket Test

With the dashboard connected, click "Start Pump" to turn pump ON.

Then in the dashboard, click the connection badge → click "Disconnect".

The pump GPIO remains in its last state — the ESP does NOT automatically turn the pump OFF when the WebSocket disconnects (unless PUMP_MAX_RUNTIME_MS > 0 in firmware config).

This is intentional: a motor that was running should not suddenly stop just because a browser tab closed — that could be dangerous mid-operation. You must explicitly click Stop Pump before disconnecting.

---

## STEP 12 — Physical Pump Test (ONLY after Steps 1–11 all pass)

**STOP — Read before proceeding.**

Only do this step after:
  ✅ Serial Monitor shows correct [PUMP] lines
  ✅ Relay clicks and LED matches the commanded state
  ✅ No mains (230V/120V) power involved

Physical pump connection (low-voltage motor / pump only):
  - Connect the pump's power supply + to relay COM terminal
  - Connect relay NO terminal to the pump motor +
  - Connect pump motor − to power supply −
  - The pump's power supply must be the correct voltage for your specific pump

> **DO NOT** connect the pump to wall outlet / mains power without proper safety isolation,
> fusing, appropriate wiring, and knowledge of electrical safety.
> A mains connection is beyond the scope of this guide.

When you click Start Pump with the physical pump wired:
  - The relay closes the COM→NO circuit
  - Current from the pump's power supply flows through the pump motor
  - The pump runs

This is PHYSICAL PUMP OPERATION — it cannot be verified by software alone.

---

## Quick Reference — Serial Monitor Expected Lines

| Action | Expected Serial Output |
|---|---|
| Click Start Pump | [PUMP] Command received : ON then [PUMP] GPIO : D1 / GPIO5 → LOW |
| Click Stop Pump | [PUMP] Command received : OFF then [PUMP] GPIO : D1 / GPIO5 → HIGH |
| Click Open Valve | [VALVE] Command received : OPEN then [VALVE] GPIO : D2 / GPIO4 → LOW |
| Click Close Valve | [VALVE] Command received : CLOSE then [VALVE] GPIO : D2 / GPIO4 → HIGH |
| ESP boot | [INIT] GPIO initialized — all relays OFF, LED OFF |

---

## Troubleshooting

| Symptom | Most Likely Cause | Fix |
|---|---|---|
| Button stays grey/disabled | WebSocket not connected | Check network, try manual IP |
| Button shows "Command in progress" forever | ESP not sending CONFIRMED | Check Serial Monitor for errors |
| Serial shows [PUMP] lines but relay doesn't click | Wrong GPIO wired (check D1 not D0) | Re-check D1 → relay IN1 wiring |
| Relay clicks but LED wrong state | LED polarity issue | Not critical — relay is switching correctly |
| Pump runs at ESP boot | Relay active-high conflict | Verify RELAY_ON=LOW, RELAY_OFF=HIGH in firmware |
| Motor does not spin when relay closes | Motor's external power supply issue | Check motor supply voltage and connections |

---

## GPIO Pin Reference

| ESP Pin | GPIO | Relay Terminal | Function |
|---|---|---|---|
| D1 | GPIO 5 | IN1 | Pump relay signal (Active-LOW) |
| D2 | GPIO 4 | IN2 | Valve relay signal (Active-LOW) |
| D4 | GPIO 2 | — | Built-in LED (status) |
| A0 | ADC 0 | — | Soil moisture sensor input |

Active-LOW means:
  D1 = LOW  (0V) → relay coil ON  → pump circuit closed
  D1 = HIGH (3V) → relay coil OFF → pump circuit open

---

## Summary Checklist

- [ ] ESP boots with relays OFF
- [ ] Serial Monitor shows boot banner at 115200 baud
- [ ] Dashboard connects (LOCAL ESP badge, green dot)
- [ ] Click Start Pump → Serial shows [PUMP] Command received : ON
- [ ] Serial shows GPIO : D1 / GPIO5 → LOW
- [ ] Relay LED ON, relay clicks
- [ ] Dashboard shows pump ACTIVE
- [ ] Click Stop Pump → Serial shows [PUMP] Command received : OFF
- [ ] Serial shows GPIO : D1 / GPIO5 → HIGH
- [ ] Relay LED OFF, relay clicks
- [ ] Dashboard shows pump STANDBY
- [ ] Repeat for valve (Open/Close)
- [ ] ESP restart → relays start OFF

Only then → connect physical pump load.

---

AgroSense SIH25015 — 2026
