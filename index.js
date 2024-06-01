const WebSocket = require("ws");
const awsIot = require("aws-iot-device-sdk");
const AWS = require("aws-sdk");

// Load environment variables (assumes you have these stored safely, e.g., in a .env file or environment configuration)
require("dotenv").config();

// Configure AWS SDK with IAM user credentials
AWS.config.update({
  accessKeyId: process.env.AWS_IAM_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_IAM_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION, // Confirm this is the correct AWS region
});

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", function connection(ws) {
  console.log("A new client connected");
});

const iot = new AWS.Iot();

// Function to retrieve the AWS IoT endpoint
const getIotEndpoint = async () => {
  try {
    const data = await iot
      .describeEndpoint({ endpointType: "iot:Data-ATS" })
      .promise();
    return data.endpointAddress;
  } catch (error) {
    console.error("Failed to retrieve IoT endpoint:", error);
    throw error;
  }
};

// Connect to AWS IoT with IAM user credentials and WebSocket
const connectIoT = async () => {
  try {
    const endpoint = await getIotEndpoint();

    const device = awsIot.device({
      host: endpoint,
      protocol: "wss",
      accessKeyId: AWS.config.credentials.accessKeyId,
      secretKey: AWS.config.credentials.secretAccessKey,
      region: AWS.config.region,
      clientId: "mqtt-client-" + Math.random().toString(16).substr(2, 8),
    });

    device.on("connect", () => {
      console.log("Connected to AWS IoT");
      device.subscribe("dronesense/temp-humidity");
      device.subscribe("dronesense/accelerometer");
      device.subscribe("dronesense/gps");
    });

    device.on("message", (topic, payload) => {
      console.log("Message received:", topic, payload.toString());
      const toSend = { topic };
      const data = JSON.parse(payload.toString());
      if (topic == "dronesense/temp-humidity") {
        toSend.temp = data.temp;
        toSend.humidity = data.humidity;
      } else if (topic == "dronesense/accelerometer") {
        toSend.x = data.accelX;
        toSend.y = data.accelY;
        toSend.z = data.accelZ;
      } else if (topic == "dronesense/gps") {
        toSend.lat = data.latitude;
        toSend.lon = data.longitude;
      }
      console.log("Sending to frontend:", toSend);
      wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(toSend)); // Send payload to frontend
        }
      });
    });
  } catch (error) {
    client.send("Failed to connect to AWS IoT");
  }
};

connectIoT();

console.log("WebSocket server running on ws://localhost:8080");
