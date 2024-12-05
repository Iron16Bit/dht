import {xorDistance} from './utils.js'

export class RoutingTable {
    constructor(localNodeId) {
        this.localNodeId = localNodeId;
        this.table = new Map()
    }

    addNode(senderId, senderIp, senderPort) {
        this.table.set(senderId, [senderIp, senderPort])
    }

    findClosestNodes(targetId, senderId) {
        var minDistance = 900719925474099
        var targetNodeKey = ''
        var targetNodeValue = ''

        console.log("Neighbours:")
        for (var [key, value] of this.table.entries()) {
            console.log(key)
            let distance = xorDistance(key, targetId)
            if (distance < minDistance && senderId != key) {
                minDistance = distance
                targetNodeKey = key
                targetNodeValue = value
            }
        }

        let retVal = {
            id: targetNodeKey,
            ip: targetNodeValue[0],
            port: targetNodeValue[1]
        };

        return retVal
    }

    size() {
        return this.table.size
    }
}