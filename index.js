const fs = require('fs').promises;
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

function agregate(entry, currentData) {
    let newData = { ...currentData };
    newData.total += 1;
    if (entry.RESULTADO === '1') newData.confirmed += 1;
    if (entry.RESULTADO === '2') newData.negative += 1;
    if (entry.RESULTADO === '3') newData.suspicious += 1;
    if (entry.FECHA_DEF !== '9999-99-99' && entry.FECHA_DEF !== '' && entry.RESULTADO === '1'){
        newData.deaths += 1;
    }else if(entry.RESULTADO === '1' ){
        const start = new Date(entry.FECHA_INGRESO);
        const fileDate = new Date(entry.FECHA_ACTUALIZACION);
        const daysDiff = (fileDate - start) / (24 * 60 * 60 * 1000);
        if(daysDiff >= 14){
            newData.recoveries += 1; 
        }else{
            newData.active += 1;
        }
    }
    return newData;
};



async function execute() {
    await download('http://187.191.75.115/gobmx/salud/datos_abiertos/datos_abiertos_covid19.zip');
    const zipLog = await deflate();
    const entries = await parse(zipLog[0].deflated);
    //const entries = await parse('200420COVID19MEXICO.csv');
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
                active : 0,
            }
        };
        municipalities[compoundKey] = agregate(entry, municipalities[compoundKey]);
    });


    //await fs.writeFile('./temp/m.json', JSON.stringify(municipalities));
};

execute();