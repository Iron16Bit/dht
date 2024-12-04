import {sha1, Queue} from './utils.js'
import {RoutingTable} from './routing_table.js'
import { WebSocketServer, WebSocket } from 'ws'
import dgram from 'dgram'

const sleep = ms => new Promise(r => setTimeout(r, ms));

function generateNodeId(ip_address) {
    let id = sha1(ip_address)
    console.log("Peer Id: " + id)
    return id;
}

export class KademliaNode {
    constructor(ip_address, port) {
        this.id = generateNodeId(ip_address);
        this.routingTable = new RoutingTable(this.id);
        this.ip_address = ip_address;
        this.port = port;
        this.responseQueue = new Queue()
        this.server = new WebSocketServer({ port });

        this.server.on('connection', socket => {
            socket.on('message', message => this.#handleMessage(socket, JSON.parse(message)));
        });
        console.log(`Node running at ws://${ip_address}:${port}`);

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

    #init() {
        //First we try to contact peers using the broadcast address
        if (!this.#broadcastPing()) {
            //If the broadcast fails, we manually PING them
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
        let dst = 'ws://' + ip + ':' + port;
        this.#sendMessage(dst, msg);
        while (this.responseQueue.len() == 0) {
            await sleep(1)
        }
    }
}