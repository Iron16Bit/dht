import {sha1, Queue} from './utils.js'
import {RoutingTable} from './routing_table.js'
import { WebSocketServer, WebSocket } from 'ws'
import dgram from 'dgram'
import os from 'os'

const sleep = ms => new Promise(r => setTimeout(r, ms));

function generateNodeId(ip_address) {
    let id = sha1(ip_address)
    console.log("Peer Id: " + id)
    return id;
}

function splitIntoBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
        batches.push(array.slice(i, i + batchSize));
    }
    return batches;
}

// Helper to calculate the full IP range
function calculateIpRange(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const netmaskParts = netmask.split('.').map(Number);

    // Calculate the network address
    const networkParts = ipParts.map((octet, i) => octet & netmaskParts[i]);

    // Calculate the broadcast address
    const broadcastParts = ipParts.map((octet, i) => octet | ~netmaskParts[i] & 255);

    const networkAddress = networkParts.join('.');
    const broadcastAddress = broadcastParts.join('.');

    return { networkAddress, broadcastAddress };
}

// Helper to generate all IPs between start and end
function generateIpRange(networkAddress, broadcastAddress) {
    const ipToNumber = (ip) =>
        ip.split('.').reduce((acc, octet, i) => acc + (Number(octet) << ((3 - i) * 8)), 0);

    const numberToIp = (num) =>
        [24, 16, 8, 0].map((shift) => (num >> shift) & 255).join('.');

    const start = ipToNumber(networkAddress) + 1; // Start at first usable address
    const end = ipToNumber(broadcastAddress) - 1; // End at last usable address

    const ips = [];
    for (let current = start; current <= end; current++) {
        ips.push(numberToIp(current));
    }
    return ips;
}

function getLocalNetworkInfo() {
    const networkInterfaces = os.networkInterfaces();

    for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];

        for (const addressInfo of addresses) {
            if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
                const { address, netmask } = addressInfo;

                const { networkAddress, broadcastAddress } = calculateIpRange(address, netmask);
                return { ip: address, netmask, networkAddress, broadcastAddress };
            }
        }
    }

    return null; // No suitable network found
}

export class KademliaNode {
    constructor() {
        let port = 3000
        this.ip_address = getLocalNetworkInfo().ip;
        this.id = generateNodeId(this.ip_address);
        this.routingTable = new RoutingTable(this.id);
        this.port = port;
        this.responseQueue = new Queue()
        this.server = new WebSocketServer({ port });

        this.server.on('connection', socket => {
            socket.on('message', message => this.#handleMessage(socket, JSON.parse(message)));
        });
        console.log(`Node running at ws://${this.ip_address}:${3000}`);

        //Setup UDP socket listener for broadcast
        this.udpSocket = dgram.createSocket('udp4');
        this.#setupBroadcastListener();

        this.#init()
    }

    #broadcastPing() {
        const broadcastAddress = '255.255.255.255';
        const broadcastPort = this.port;

        const message = JSON.stringify({
            type: 'PING',
            senderId: this.id,
            senderIp: this.ip_address,
            senderPort: this.port,
        });

        this.udpSocket.send(message, broadcastPort, broadcastAddress, (error) => {
            if (error) {
                console.error('Error sending broadcast PING:', error.message);
                return false; 
            } else {
                console.log('Broadcast PING sent to:', broadcastAddress);
                return true;
            }
        });
    }

    async #manualPingLAN(batchSize = 50, delay = 1000) {
        const networkInfo = getLocalNetworkInfo();
        if (!networkInfo) {
            console.error('Unable to determine network information.');
            return;
        }

        const { networkAddress, broadcastAddress } = networkInfo;
        const ipRange = generateIpRange(networkAddress, broadcastAddress);
        const batches = splitIntoBatches(ipRange, batchSize);

        console.log(`Pinging all IPs in range: ${networkAddress} - ${broadcastAddress}`);
        console.log(`Total IPs: ${ipRange.length}, Batches: ${batches.length}`);

        const message = JSON.stringify({
            type: 'PING',
            senderId: this.id,
        });

        // Process batches sequentially with a delay
        const sendBatch = (batchIndex) => {
            if (batchIndex >= batches.length) {
                console.log('Finished sending all batches.');
                return;
            }

            const batch = batches[batchIndex];
            console.log(`Sending batch ${batchIndex + 1}/${batches.length}:`, batch);

            batch.forEach((targetIp) => {
                this.udpSocket.send(message, 0, message.length, this.port, targetIp, (err) => {
                    if (err) {
                        console.error(`Error sending PING to ${targetIp}:`, err.message);
                    } else {
                        console.log(`PING sent to ${targetIp}`);
                    }
                });
            });

            // Schedule the next batch after the delay
            setTimeout(() => sendBatch(batchIndex + 1), delay);
        };

        // Start sending the first batch
        sendBatch(0);
    }

    async #init() {
        //First we try to contact peers using the broadcast address
        let broadcastResult = this.#broadcastPing();
        await sleep(1)
        console.log("Waiting for answers...")
        await sleep(5000)
        //The broadcast message fails if it isn't sent or we haven't received any answer (the msg might be blocked by the router)
        if (broadcastResult == false || this.routingTable.size() == 0) {
            console.log("Broadcast failed. Manually pinging all addresses in the local network...")
            await this.#manualPingLAN()
        }
    }

    // Set up listener for incoming UDP broadcast messages
    #setupBroadcastListener() {
        this.udpSocket.on('message', (message, remote) => {
            try {
                const parsed = JSON.parse(message);
                this.#handleUdpMessage(parsed, remote);
            } catch (error) {
                console.error('Error parsing UDP message:', error.message);
            }
        });

        this.udpSocket.bind(this.port, this.ip_address, () => {
            this.udpSocket.setBroadcast(true)
            console.log(`UDP listening on ${this.ip_address}:${this.port}`);
        });
    }

    // Handle incoming UDP messages
    #handleUdpMessage(message, remote) {
        const { type, senderId, senderIp, senderPort } = message;

        switch (type) {
            case 'PING':
                if (senderId != this.id) {
                console.log(`Received PING from ${senderId} (${senderIp}:${senderPort})`);

                    // Add sender to routing table
                    this.routingTable.addNode(senderId, senderIp, senderPort);

                    // Respond with a PONG
                    const response = JSON.stringify({
                        type: 'PONG',
                        senderId: this.id,
                        senderIp: this.ip_address,
                        senderPort: this.port
                    });
                    this.udpSocket.send(response, senderPort, senderIp, (error) => {
                        if (error) console.error('Error sending PONG:', error.message);
                        else console.log(`PONG sent to ${senderIp}:${senderPort}`);
                    });
                }
                break;

            case 'PONG':
                if (senderId != this.id) {
                    console.log(`Received PONG from ${senderId} (${senderIp}:${senderPort})`);

                    // Add sender to routing table
                    this.routingTable.addNode(senderId, senderIp, senderPort);
                }
                break;

            default:
                console.log('Unknown UDP message type:', type);
        }
    }

    #handleMessage(socket, message) {
        const { type, data, senderId, senderIp, senderPort } = message;
    
        switch (type) {
            case 'PING':
                console.log(this.routingTable)
                console.log(`Received PING from node: ${senderId}`);
                //Add node to routing table
                this.routingTable.addNode(senderId, senderIp, senderPort)
                console.log(this.routingTable)
                socket.send(JSON.stringify({ type: 'PONG', data: this.id }));
                break;
    
            case 'FIND_NODE':
                const closestNodes = this.routingTable.findClosestNodes(data.targetId, senderId);
                socket.send(JSON.stringify({ type: 'NODE_LIST', data: closestNodes }));
                break;
    
            default:
                console.log('Unknown message type:', type);
        }
    }

    #sendMessage(targetAddress, message) {
        const socket = new WebSocket(targetAddress);
    
        socket.on('open', () => {
            // Attach sender's info to the message
            message.senderId = this.id;
            message.senderIp = this.ip_address;
            message.senderPort = this.port;
            socket.send(JSON.stringify(message));
        });
    
        socket.on('message', (response) => {
            const parsed = JSON.parse(response);
            if (parsed.type == 'PONG') {
                //Our PING has reached a peer, so we add it to our routing table and consume the message
                this.responseQueue.dequeue()
                let tmp = targetAddress.split("//")
                let [ip, port] = tmp[1].split(":")
                this.routingTable.addNode(parsed.data, ip, port)
            }
            this.responseQueue.enqueue(parsed)
            console.log(`Response from ${targetAddress}:`, parsed);
        });
    
        socket.on('error', (error) => {
            console.error(`Error connecting to ${targetAddress}:`, error.message);
        });
    }
    
    async sendMessage(ip, port, msg) {
        let initialLen = this.responseQueue.len()
        let dst = 'ws://' + ip + ':' + port;
        this.#sendMessage(dst, msg);
        while (this.responseQueue.len() == initialLen) {
            await sleep(1)
        }
    }
}