/*
 * 3615 SLICE terminal: bridges a Minitel to the videotex server over a websocket.
 * Configuration comes from config.h, generated from .env by `npm run esp32:config`.
 * Based on Minitel1B_Websocket_Client by iodeo (dec 2021).
 */

#include <WiFi.h>
#include <WebSocketsClient.h> // src: https://github.com/Links2004/arduinoWebSockets.git
#include <Minitel1B_Hard.h>   // src: https://github.com/eserandour/Minitel1B_Hard.git

// ---------------------------------------
// ------ Minitel port configuration

#define MINITEL_PORT Serial2       // for Minitel-ESP32 devboard
#define MINITEL_BAUD 4800          // 1200 / 4800 / 9600 depending on minitel type
#define MINITEL_DISABLE_ECHO true  // true if characters are repeated when typing

// ---------------------------------------
// ------ Debug port configuration

#define DEBUG true

#if DEBUG
  #define DEBUG_PORT Serial       // for Minitel-ESP32 devboard
  #define DEBUG_BAUD 115200       // set serial monitor accordingly
  #define debugBegin(x)     DEBUG_PORT.begin(x)
  #define debugPrintf(...)    DEBUG_PORT.printf(__VA_ARGS__)
#else // Empty macro functions
  #define debugBegin(x)     
  #define debugPrintf(...)
#endif

// ---------------------------------------
// ------ WiFi and server configuration, see config.h

#include "config.h"

#define WIFI_CONNECT_TIMEOUT_MS 10000

const char* host = WS_HOST;
const int port = WS_PORT;
const char* path = WS_PATH;
const bool ssl = WS_SSL;
const int ping_ms = 0;
const char* protocol = WS_PROTOCOL;

WiFiClient client;
WebSocketsClient webSocket;
Minitel minitel(MINITEL_PORT);

bool connectWiFi() {
  debugPrintf("\n> Wifi setup\n");
  for (int i = 0; i < networkCount; i++) {
    debugPrintf("  Connecting to %s ", networks[i].ssid);
    WiFi.begin(networks[i].ssid, networks[i].password);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_CONNECT_TIMEOUT_MS) {
      delay(500);
      debugPrintf(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
      debugPrintf("\n  WiFi connected with IP %s\n", WiFi.localIP().toString().c_str());
      return true;
    }
    debugPrintf("\n  Failed to connect to %s\n", networks[i].ssid);
    WiFi.disconnect();
  }
  return false;
}

void connectWebSocket() {
  debugPrintf("\n> Websocket connection\n");
  if (protocol[0] == '\0') {
    if (ssl) webSocket.beginSSL(host, port, path);
    else webSocket.begin(host, port, path);
  }
  else {
    debugPrintf("  - subprotocol added\n");
    if (ssl) webSocket.beginSSL(host, port, path, protocol);
    else webSocket.begin(host, port, path, protocol);
  }
  
  webSocket.onEvent(webSocketEvent);
  
  if (ping_ms != 0) {
    debugPrintf("  - heartbeat ping added\n");
    webSocket.enableHeartbeat(ping_ms, 3000, 2);
  }
}

void setup() {

  debugBegin(DEBUG_BAUD);
  debugPrintf("\n-----------------------\n");
  debugPrintf("\n> Debug port ready\n");

  debugPrintf("\n> Minitel setup\n");
  int baud = minitel.searchSpeed();
  if (baud != MINITEL_BAUD) baud = minitel.changeSpeed(MINITEL_BAUD);
  debugPrintf("  - Baud detected: %u\n", baud);
  if (MINITEL_DISABLE_ECHO) {
    minitel.echo(false);
    debugPrintf("  - Echo disabled\n");
  }

  while (!connectWiFi()) {
    debugPrintf("[WiFi] All networks failed, retrying in 5s...\n");
    delay(5000);
  }

  connectWebSocket();

  debugPrintf("\n> End of setup\n\n");

}

void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    debugPrintf("[WiFi] Disconnected, attempting reconnect...\n");
    if (connectWiFi()) {
      connectWebSocket();
    } else {
      debugPrintf("[WiFi] All networks failed, retrying in 5s...\n");
      delay(5000);
      return;
    }
  }

  webSocket.loop();

  uint32_t key = minitel.getKeyCode(false);
  if (key != 0) {
    debugPrintf("[KB] got code: %X\n", key);
    uint8_t payload[4];
    size_t len = 0;
    for (len = 0; key != 0 && len < 4; len++) {
      payload[3-len] = uint8_t(key);
      key = key >> 8;
    }
    webSocket.sendTXT(payload+4-len, len);
  }

}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t len) {
  switch(type) {
    case WStype_DISCONNECTED:
      debugPrintf("[WS] Disconnected!\n");
      break;
      
    case WStype_CONNECTED:
      debugPrintf("[WS] Connected to url: %s\n", payload);
      break;
      
    case WStype_TEXT:
      debugPrintf("[WS] got %u chars\n", len);
      if (len > 0) {
        debugPrintf("  >  %s\n", payload);
        for (size_t i = 0; i < len; i++) {
          minitel.writeByte(payload[i]);
        }
      }
      break;
      
    case WStype_BIN:
      debugPrintf("[WS] got %u binaries - ignored\n", len);
      break;
      
    case WStype_ERROR:
      debugPrintf("[WS] WStype_ERROR\n");
      break;
      
    case WStype_FRAGMENT_TEXT_START:
      debugPrintf("[WS] WStype_FRAGMENT_TEXT_START\n");
      break;
      
    case WStype_FRAGMENT_BIN_START:
      debugPrintf("[WS] WStype_FRAGMENT_BIN_START\n");
      break;
      
    case WStype_FRAGMENT:
      debugPrintf("[WS] WStype_FRAGMENT\n");
      break;
      
    case WStype_FRAGMENT_FIN:
      debugPrintf("[WS] WStype_FRAGMENT_FIN\n");
      break;
  }
}
