#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"

// --- Configuration ---
const char* ssid = "REDMI Note 15 Pro+ 5G";
const char* password = "12345678900";

// WAJIB TUKAR: Gantikan dengan Web App URL dari Apps Script (mula dengan https://script.google.com/macros/s/... dan akhir dengan /exec)
const char* googleScriptURL = "https://script.google.com/macros/s/AKfycbzihvXMa6sc02mAOf3XEtHs5Ag4UZLIMhcMi5FN7oHOtD7f4X-fdOXpsSRrhfKtDJHg/exec";

#define DHTPIN 13
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Sela masa penghantaran: 30000 ms (30 saat) untuk ujian. Tukar ke 600000 (10 minit) selepas berjaya.
const unsigned long SAMPLING_INTERVAL = 600000; 
unsigned long previousMillis = 0;
bool firstRun = true;

void setup() {
  Serial.begin(115200);
  dht.begin();
  delay(2000); // Tunggu 2 saat supaya sensor DHT11 stabil selepas boot
  connectWiFi();
}

void loop() {
  unsigned long currentMillis = millis();

  if (firstRun || (currentMillis - previousMillis >= SAMPLING_INTERVAL)) {
    firstRun = false;
    previousMillis = currentMillis;

    Serial.println("Membaca sensor DHT11...");
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    // Papar bacaan mentah untuk semakan (debugging)
    Serial.printf("Bacaan Mentah -> Temp: %.2f°C | Hum: %.2f%%\n", temp, hum);

    if (validateSensorReading(temp, hum)) {
      sendDataToGoogleSheets(temp, hum);
    } else {
      Serial.println("[ERROR] Invalid DHT11 reading discarded.");
    }
  }
}

bool validateSensorReading(float temp, float hum) {
  if (isnan(temp) || isnan(hum)) return false;
  // Had sah DHT11: Suhu 0°C - 50°C, Kelembapan 20% - 95%
  if (temp < 0.0 || temp > 50.0) return false;
  if (hum < 20.0 || hum > 95.0) return false;
  return true;
}

void sendDataToGoogleSheets(float temp, float hum) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(googleScriptURL) + "?temperature=" + String(temp, 2) + "&humidity=" + String(hum, 2);

    Serial.println("Menghantar data ke Google Sheets...");
    http.begin(url);
    http.setTimeout(10000); // Had masa menunggu 10 saat supaya ESP32 tidak sangkut
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    int httpResponseCode = http.GET();
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.printf("[OK] Sent Temp: %.2f°C, Hum: %.2f%% | HTTP: %d | Reply: %s\n", temp, hum, httpResponseCode, response.c_str());
    } else {
      Serial.printf("[FAIL] HTTP Error: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? "\nWiFi Connected!" : "\nWiFi Connection Failed.");
}