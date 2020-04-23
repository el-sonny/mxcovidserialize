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
    console.log('parsing');
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

async function loadMasterFile() {
    const data = await fs.readFile('./data/municipios.json');
    return JSON.parse(data);
};

async function update(date) {
    //Date should be in this format: 12.04.2020
    const base = 'http://187.191.75.115/gobmx/salud/datos_abiertos/';
    const file = date ? 'historicos/datos_abiertos_covid19_' + date + '.zip' : 'datos_abiertos_covid19.zip';
    await download(base + file);
    return zipLog = await deflate();
};

async function execute() {
    //const zipLog = await update();
    //const entries = await parse(zipLog[0].deflated);
    const entries = await parse('200422COVID19MEXICO.csv');
    console.log('summarizing');
    const entryDates = entries[0].FECHA_ACTUALIZACION;
    const summary = summarizeCases(entries);
    const municipalities = await loadMasterFile();

    const timeSeries = municipalities.map(m => {
        if (!m.entries) m.entries = {};
        const key = m.entityCode + m.municipalityCode;
        m.entries[entryDates] = summary[key];
        return m;
    });
    //console.log(municipalities[1528], summary[23005]);
    await fs.writeFile('./temp/timeSeries.json', JSON.stringify(timeSeries));
};

execute();