//Compute sha1 of a string
export async function sha1(str) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-1', enc.encode(str));
    return Array.from(new Uint8Array(hash))
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');
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