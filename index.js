'use strict'

const Fs = require('fs');
const Path = require('path');
const Axios = require('axios');
const DecompressZip = require('decompress-zip');
const csv = require('csvtojson');
const path = Path.resolve(__dirname, 'temp', 'pkg.zip');

async function download(url) {
    const writer = Fs.createWriteStream(path);
    const response = await Axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
};

async function deflate() {
    return new Promise((resolve, reject) => {
    	const unzipper = new DecompressZip(path)
        unzipper.on('extract', resolve);
        unzipper.on('error', reject);
        unzipper.extract({ path: Path.resolve(__dirname, 'data', 'source', 'csv') });
    });
};

async function parse(file) {
    return csv().fromFile(Path.resolve(__dirname, 'data', 'source', 'csv', file));
};

async function execute() {
    console.log('downloading')
    await download('http://187.191.75.115/gobmx/salud/datos_abiertos/datos_abiertos_covid19.zip');
    console.log('deflating');
    const zipLog = await deflate();
    console.log('parsing');
    const json = await parse(zipLog[0].deflated);
    console.log(json.length);
};

execute();