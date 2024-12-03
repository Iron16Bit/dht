import {KademliaNode} from './src/node_setup.js'

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 
 * @param {KademliaNode} node 
 */
async function sendWrapper(node, dst, msg) {
    node.sendMessage(dst, msg);
    while (node.responseQueue.len() == 0) {
        await sleep(1)
    }
}

async function main() {
    const node = new KademliaNode("192.168.1.223", 3000);
    await sendWrapper(node, 'ws://192.168.1.138:3000', { type: 'PING' });
    node.responseQueue.dequeue()
    await sendWrapper(node, 'ws://192.168.1.138:3000', {type: 'FIND_NODE', data: {targetId: 'b55ddb8a2349811633318106d5a837f26bdd79bc'}});
    let lastResponse = node.responseQueue.dequeue()
    await sendWrapper(node, 'ws://' + lastResponse.data[1][0] + ':' + lastResponse.data[1][1], { type: 'PING' })
}

main()