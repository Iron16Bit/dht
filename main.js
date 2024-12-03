import {KademliaNode} from './src/node_setup'

function main() {
    const node = new KademliaNode("192.168.1.223", 3000);
    node.sendMessage('ws://192.168.1.223:3001', { type: 'PING' });
}

main()