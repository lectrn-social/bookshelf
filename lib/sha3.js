const { SHA3 } = require('sha3');

function hash(buf) {
    if (typeof buf === 'string') {
        buf = Buffer.from(buf, 'utf8');
    }

    if (!Buffer.isBuffer(buf)) {
        throw new Error("buf must be a string or Buffer");
    }

    let hash = new SHA3(512);

    hash.update(buf);
    return hash.digest('hex');
}

module.exports = hash;