import http from 'http';
import { WebSocketServer } from 'ws';
import os from 'os';
import fs from 'fs';

// Function to list network interfaces and their IPv4 addresses
function listNetworkInterfaceNames() {
    const interfaces = os.networkInterfaces();
    const result = [];

    for (const [name, ifaceArray] of Object.entries(interfaces)) {
        for (const iface of ifaceArray) {
            if (iface.family === 'IPv4' && !iface.internal) {
                result.push(`${name}: ${iface.address}`);
            }
        }
    }

    return result;
}

// Create an HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running\n');
});

// Create a WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients (as a map with IP addresses)
const clients = new Map(); // Key: senderIp, Value: WebSocket instance

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
    console.log('A client connected');

    // Listen for messages from the client
    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            console.log(parsed)
            const { type, data, senderId, senderIp, senderPort } = parsed;
            // Parse the incoming message as JSON

            if (!type || !senderId) {
                throw new Error("Invalid message format: 'type' and 'senderId' are required.");
            }

            if (type == 'PING') {
                // Add the client to the clients map
                if (!clients.has(senderIp)) {
                    clients.set(senderId, { ws, senderIp, senderPort });
                    console.log(`Client added: IP=${senderIp}, ID=${senderId}`);
                }

                // If you have been PINGED by the browser-client, send interface list
                if (senderId == "browser-client") {
                    const interfaces = listNetworkInterfaceNames();
                    ws.send(JSON.stringify({ type: 'INTERFACE_SETUP', senderId: 'server', data: interfaces }));
                }
                // Otherwise respond with PONG
                ws.send(JSON.stringify({ type: 'PONG', senderId: 'server'}));
            } else if (type == 'INTERFACE_SELECTED') {
                let [name,ip] = data.split(":")
                fs.writeFile("./interface.txt", ip.slice(1), function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            } else {
                // Forward message from client to server or viceversa
                for (const peer of clients) {
                    if (peer[0] != senderId) {
                        peer[1]["ws"].send(JSON.stringify(parsed))
                    }
                }
            }
        } catch (err) {
            console.error('Failed to process message:', err.message);
            ws.send('Error: Invalid message format. Expected JSON with type and senderId.');
        }
    });
});

// Start the server
server.listen(3001, () => {
    console.log('Server is listening on port 3001');
});
