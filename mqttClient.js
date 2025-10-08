const mqtt = require("mqtt");

let client;

if (!global.mqttClient) {
  client = mqtt.connect("mqtt://broker.hivemq.com:1883");

  client.on("connect", () => {
    console.log("✅ MQTT Connected");
    client.subscribe("feeder/info");
    client.subscribe("feeder/control");
    client.subscribe("feeder/schedule");
  });

  client.on("error", (err) => {
    console.error("❌ MQTT Error:", err);
  });

  global.mqttClient = client;
} else {
  client = global.mqttClient;
}

module.exports = client;
