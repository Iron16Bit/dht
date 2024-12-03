import {sha1} from './utils.js'
import {RoutingTable} from './routing_table.js'
import { WebSocketServer, WebSocket } from 'ws'

function generateNodeId(ip_address) {
    let id = sha1(ip_address)
    console.log(id)
    return id;
}

export class KademliaNode {
    constructor(ip_address, port) {
        this.id = generateNodeId(ip_address);
        this.routingTable = new RoutingTable(this.id);
        this.ip_address = ip_address;
        this.port = port;
        this.server = new WebSocketServer({ port });

        this.server.on('connection', socket => {
            socket.on('message', message => this.handleMessage(socket, JSON.parse(message)));
        });

        console.log(`Node running at ws://${ip_address}:${port}`);
    }

    handleMessage(socket, message) {
        const { type, data, senderId, senderIp, senderPort } = message;
    
        switch (type) {
            case 'PING':
                console.log(`Received PING from node: ${senderId}`);
                //Add node to routing table
                this.routingTable.addNode(senderId, senderIp, senderPort)
                socket.send(JSON.stringify({ type: 'PONG', data: this.id }));
                break;
    
            case 'FIND_NODE':
                const closestNodes = this.routingTable.findClosestNodes(data.targetId);
                socket.send(JSON.stringify({ type: 'NODE_LIST', data: closestNodes }));
                break;
    
            default:
                console.log('Unknown message type:', type);
        }
    }

    sendMessage(targetAddress, message) {
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
            console.log(`Response from ${targetAddress}:`, parsed);
        });
    
        socket.on('error', (error) => {
            console.error(`Error connecting to ${targetAddress}:`, error.message);
        });
    }
}