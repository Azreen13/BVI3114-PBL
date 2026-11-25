// 1. FUNGSI MENERIMA DATA SUHU & KELEMBAPAN DARI ESP32
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sensorSheet = ss.getSheetByName("SensorData");

  if (!sensorSheet) {
    sensorSheet = ss.insertSheet("SensorData");
    sensorSheet.appendRow(["Timestamp", "Temperature", "Humidity"]);
  }

  if (e && e.parameter && e.parameter.temperature && e.parameter.humidity) {
    var temp = parseFloat(e.parameter.temperature);
    var hum = parseFloat(e.parameter.humidity);

    if (Number.isFinite(temp) && Number.isFinite(hum)) {
      sensorSheet.appendRow([new Date(), temp, hum]);
      return ContentService.createTextOutput("OK: Temp=" + temp + ", Hum=" + hum);
    }
  }

  return ContentService.createTextOutput("ERROR: Missing or invalid temperature/humidity");
}

// 2. MENU MANUAL DALAM GOOGLE SHEETS (Untuk Live Demo)
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Sensor Data')
    .addItem('Generate Forecasts', 'generateForecasts')
    .addToUi();
}

// 3. KOD ASAL ANDA: RAMALAN 24 JAM MENGGUNAKAN EMA
function generateForecasts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sensorSheet = ss.getSheetByName("SensorData");
  var forecastSheet = ss.getSheetByName("Forecasts");

  // Buat tab Forecasts automatik jika belum ada
  if (!forecastSheet) {
    forecastSheet = ss.insertSheet("Forecasts");
    forecastSheet.appendRow([
      "Timestamp", 
      "Temp Forecast", "Temp Upper", "Temp Lower", 
      "Humidity Forecast", "Humidity Upper", "Humidity Lower"
    ]);
  }

  if (sensorSheet.getLastRow() < 2) {
    Logger.log("Tiada data mencukupi dalam SensorData.");
    return;
  }

  var data = sensorSheet.getRange(
    2, 1, sensorSheet.getLastRow() - 1, 3
  ).getValues();

  var temperatures = [];
  var humidities = [];

  for (var i = 0; i < data.length; i++) {
    var temp = Number(data[i][1]);
    var hum = Number(data[i][2]);

    if (Number.isFinite(temp) && Number.isFinite(hum)) {
      temperatures.push(temp);
      humidities.push(hum);
    }
  }

  if (temperatures.length === 0) return;

  var alpha = 0.3;

  var tempEMA = Number(calculateEMA(temperatures, alpha).toFixed(2));
  var humidityEMA = Number(calculateEMA(humidities, alpha).toFixed(2));

  var lastTimestamp = new Date(data[data.length - 1][0]);
  var output = [];

  for (var h = 1; h <= 24; h++) {
    var nextTime = new Date(
      lastTimestamp.getTime() + h * 60 * 60 * 1000
    );

    output.push([
      nextTime,
      tempEMA,
      Number((tempEMA + 2).toFixed(2)),
      Number((tempEMA - 2).toFixed(2)),
      humidityEMA,
      Number(Math.min(100, humidityEMA + 5).toFixed(2)),
      Number(Math.max(0, humidityEMA - 5).toFixed(2))
    ]);
  }

  if (forecastSheet.getMaxRows() > 1) {
    forecastSheet.getRange(
      2, 1, forecastSheet.getMaxRows() - 1, 7
    ).clearContent();
  }

  forecastSheet.getRange(
    2, 1, output.length, 7
  ).setValues(output);

  SpreadsheetApp.flush();

  Logger.log("24-hour forecasting completed!");
}

function calculateEMA(values, alpha) {
  var ema = values[0];

  for (var i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
  }

  return ema;
}