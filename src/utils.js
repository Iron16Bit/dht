import crypto from 'crypto';

//Compute sha1 of a string
export function sha1(data) {
    return crypto.createHash('sha1').update(data, 'binary').digest('hex')
}

export function xorDistance(id1, id2) {
    const buffer1 = Array.from(id1).map(char => parseInt(char, 16));
    const buffer2 = Array.from(id2).map(char => parseInt(char, 16));
    let result = 0;

    for (let i = 0; i < buffer1.length; i++) {
        result = (result << 4) | (buffer1[i] ^ buffer2[i]);
    }

    return result;
}

//Queue implementation in JS
export class Queue {
    constructor() {
        this.items = {}
        this.frontIndex = 0
        this.backIndex = 0
    }
    enqueue(item) {
        this.items[this.backIndex] = item
        this.backIndex++
        return item + ' inserted'
    }
    dequeue() {
        const item = this.items[this.frontIndex]
        delete this.items[this.frontIndex]
        this.frontIndex++
        return item
    }
    peek() {
        return this.items[this.frontIndex]
    }
    len() {
        return this.backIndex - this.frontIndex
    }
    contains(val) {
        var index = this.frontIndex;
        while (index < this.backIndex) {
            if (this.items[index] == val) {
                return true;
            }
            index += 1;
        }
        return false;
    }
    get printQueue() {
        return this.items;
    }
}