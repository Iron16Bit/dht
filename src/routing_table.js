import {xorDistance} from './utils.js'

export class RoutingTable {
    constructor(localNodeId) {
        this.localNodeId = localNodeId;
        this.table = new Map()
    }

    addNode(senderId, senderIp, senderPort) {
        this.table.set(senderId, [senderIp, senderPort])
    }

    findClosestNodes(targetId) {
        var minDistance = 900719925474099
        var targetNodeKey = ''
        var targetNodeValue = ''

        for (var [key, value] of myMap.entries()) {
            distance = xorDistance(key.id, targetId)
            if (distance < minDistance) {
                minDistance = distance
                targetNodeKey = key
                targetNodeValue = value
            }
        }

        return [targetNodeKey, targetNodeValue]
    }
}