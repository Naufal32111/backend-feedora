const mqtt = require("mqtt");

// Ganti broker sesuai kebutuhan
const client = mqtt.connect("mqtt://broker.hivemq.com:1883");

// Ketika berhasil connect
client.on("connect", () => {
  console.log("✅ MQTT Connected");

  // Subscribe semua topik yang dibutuhkan
  client.subscribe("feeder/info");
  client.subscribe("feeder/control");
  client.subscribe("feeder/schedule");
});

// Error handling
client.on("error", (err) => {
  console.error("❌ MQTT Error:", err);
});

module.exports = client; // 🚀 Export instance MQTT
