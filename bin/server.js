import http from 'http';
import { WebSocketServer } from 'ws';
import os from 'os';
import fs from 'fs';

// List all available interfaces names
function listNetworkInterfaceNames() {
    const networkInterfaces = os.networkInterfaces();
    const interfaceNames = [];

    // Loop through each interface
    for (const interfaceName in networkInterfaces) {
        if (networkInterfaces.hasOwnProperty(interfaceName)) {
            // Add the interface name to the list
            interfaceNames.push(interfaceName);
        }
    }

    return interfaceNames;
}

// Get a specific networkInterface IP given a name
function getNetworkInterfaceByName(interfaceName) {
    const networkInterfaces = os.networkInterfaces();

    // Check if the network interface exists
    if (networkInterfaces[interfaceName]) {
        // Find the first IPv4 address for the given interface
        const ipv4Details = networkInterfaces[interfaceName].find(details => details.family === 'IPv4');
        
        if (ipv4Details) {
            return ipv4Details.address; // Return the IPv4 address
        } else {
            console.log(`No IPv4 address found for interface "${interfaceName}".`);
            return null;
        }
    } else {
        console.log(`Network interface "${interfaceName}" not found.`);
        return null; // Return null if the interface doesn't exist
    }
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
                const selectedInterface = getNetworkInterfaceByName(data)
                fs.writeFile("../interface.txt", selectedInterface, function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
            } else {
                // Forward message from client to server or viceversa
                for (const [id, clientInfo] of clients) {
                    if (clientInfo.id != senderId && clientInfo.ws.readyState === WebSocketServer.OPEN) {
                        clientInfo.ws.send(JSON.stringify(enrichedMessage));
                    }
                }
            }
        } catch (err) {
            console.error('Failed to process message:', err.message);
            ws.send('Error: Invalid message format. Expected JSON with type and senderId.');
        }
    });

    // Handle connection close
    ws.on('close', () => {
        console.log('A client disconnected');
        // Remove client from the clients map
        clients.delete(senderIp);
    });
});

// Start the server
server.listen(3001, () => {
    console.log('Server is listening on port 3001');
});
