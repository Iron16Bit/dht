import {KademliaNode} from './src/node_setup.js'

async function main() {
    const node = new KademliaNode("192.168.1.138", 3000);
    //await node.sendMessage('192.168.1.138', 3000, { type: 'PING' })
    //await node.sendMessage('192.168.1.138', 3000, {type: 'FIND_NODE', data: {targetId: 'b55ddb8a2349811633318106d5a837f26bdd79bc'}})
    //node.responseQueue.dequeue()
}

main()