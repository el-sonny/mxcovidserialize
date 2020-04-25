const fs = require('fs').promises;
const Fs = require('fs');
const Path = require('path');
const Axios = require('axios');
const DecompressZip = require('decompress-zip');
const csv = require('csvtojson');
const path = Path.resolve(__dirname, 'temp', 'pkg.zip');
const ProgressBar = require('progress');

async function download(url) {
    console.log('Connecting …')
    const { data, headers } = await Axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    const totalLength = headers['content-length'];
    console.log('Starting download');
    const progressBar = new ProgressBar('-> downloading [:bar] :percent :etas', {
        width: 40,
        complete: '=',
        incomplete: ' ',
        renderThrottle: 1,
        total: parseInt(totalLength)
    });
    const writer = Fs.createWriteStream(path);
    data.on('data', (chunk) => progressBar.tick(chunk.length));
    data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    })
};

// Deflates temp/pkg.zip, needs to be refactored to consider specific zip file to avoid unwanted side-effects.
async function deflate() {
    console.log('deflating');
    return new Promise((resolve, reject) => {
        const unzipper = new DecompressZip(path);
        unzipper.on('extract', resolve);
        unzipper.on('error', reject);
        unzipper.extract({ path: Path.resolve(__dirname, 'data', 'source', 'csv') });
    });
};

async function parse(file) {
    return csv().fromFile(Path.resolve(__dirname, 'data', 'source', 'csv', file));
};

function agregate(entry, currentData) {
    let newData = { ...currentData };
    newData.total += 1;
    if (entry.RESULTADO === '1') newData.confirmed += 1;
    if (entry.RESULTADO === '2') newData.negative += 1;
    if (entry.RESULTADO === '3') newData.suspicious += 1;
    if (entry.FECHA_DEF !== '9999-99-99' && entry.FECHA_DEF !== '' && entry.RESULTADO === '1') {
        newData.deaths += 1;
    } else if (entry.RESULTADO === '1') {
        const start = new Date(entry.FECHA_INGRESO);
        const fileDate = new Date(entry.FECHA_ACTUALIZACION);
        const daysDiff = (fileDate - start) / (24 * 60 * 60 * 1000);
        if (daysDiff >= 14) {
            newData.recoveries += 1;
        } else {
            newData.active += 1;
        }
    }
    return newData;
};

// Sums and counts each type of case *Active and Recovered data is not accurate needs to be checked
function summarizeCases(entries) {
    let municipalities = {};
    entries.forEach(entry => {
        const compoundKey = entry.ENTIDAD_RES + entry.MUNICIPIO_RES;
        if (!municipalities[compoundKey]) {
            municipalities[compoundKey] = {
                total: 0,
                suspicious: 0,
                confirmed: 0,
                deaths: 0,
                recoveries: 0,
                negative: 0,
                active: 0,
            }
        };
        municipalities[compoundKey] = agregate(entry, municipalities[compoundKey]);
    });
    return municipalities;
};

async function loadJSON(file) {
    const data = await fs.readFile(file);
    return JSON.parse(data);
};

//Downloads and Unzips the open data file for specified date, if none is specified then latest file is downloaded. Returns filename for unzipped file
//Date should be in this format: 12.04.2020
async function update(date) {
    const base = 'http://187.191.75.115/gobmx/salud/datos_abiertos/';
    const file = date ? 'historicos/datos_abiertos_covid19_' + date + '.zip' : 'datos_abiertos_covid19.zip';
    await download(base + file);
    const zipLog = await deflate();
    return zipLog[0].deflated;
};

function agregateDataDay(original, summary, date) {
    const timeSeries = original.map(m => {
        if (!m.entries) m.entries = {};
        const key = m.entityCode + m.municipalityCode;
        m.entries[date] = summary[key];
        return m;
    });
    return timeSeries;
};

async function saveJSON(filename, json) {
    return fs.writeFile(filename, JSON.stringify(json));
};

//Downloads all of the files released by MX government to the day, returns array with downloaded filenames
async function downloadAll() {
    // THe first day that the Mexican Government started releasing data
    let files = [];
    const start = new Date('2020-04-13');
    const today = new Date();
    const daysDiff = Math.floor((today - start) / (24 * 60 * 60 * 1000));
    for (let i = 0; i < daysDiff; i++) {
        const dateString = [('0' + start.getDate()).slice(-2), ('0' + (start.getMonth() + 1)).slice(-2), start.getFullYear()].join('.');
        console.log(dateString);
        let file = await update(dateString);
        files.push(file);
        start.setDate(start.getDate() + 1);
    }
    file = await update();
    files.push(file);
    return files;
};

//Downloads all source data and creates the JSON summary file
async function initialize() {
    const files = await downloadAll();
    let timeSeries = await loadJSON('./data/municipios.json');
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        const date = [file.slice(4, 6), file.slice(2, 4), file.slice(0, 2)].join('-');
        const entries = await parse(file);
        const summary = summarizeCases(entries);
        timeSeries = agregateDataDay(timeSeries, summary, date);
    };
    await saveJSON('./data/output/timeSeries.json', timeSeries);
};

async function execute() {
    await initialize();
};

execute();