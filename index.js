const downloadHelper = require('./helpers/downloadHelper.js');
const fs = require('fs').promises;
const Path = require('path');
const csv = require('csvtojson');
const Moment = require('moment');

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

function agregateDataDay(original, summary, date) {
    const timeSeries = original.map(m => {
        if (typeof m.entries === 'undefined') m.entries = {};
        const key = m.entityCode + m.municipalityCode;
        m.entries[date] = summary[key];
        return m;
    });
    return timeSeries;
};

async function saveJSON(filename, json) {
    return fs.writeFile(filename, JSON.stringify(json));
};

function getDateArray(start, end) {
    let arr = new Array();
    let dt = new Date(start);
    while (dt <= end) {
        arr.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}

//Downloads and processes only the latest date returns
async function update() {
    const file = await downloadHelper.download();
    let timeSeries = await loadJSON('./data/output/timeSeries.json');
    const date = [file.slice(4, 6), file.slice(2, 4), file.slice(0, 2)].join('-');
    const entries = await parse(file);
    const summary = summarizeCases(entries);
    timeSeries = agregateDataDay(timeSeries, summary, date);
    await saveJSON('./data/output/timeSeries.json', timeSeries);
}

async function makeCSV(dimension) {
    console.log(dimension);
    const timeSeries = await loadJSON('./data/output/timeSeries.json');
    const startDate = new Date('2020-04-13');
    const endDate = new Date();
    const dateArr = getDateArray(startDate, endDate);
    const extract = timeSeries.map(m => {
        let entry = { ...m };
        delete entry.entries;
        dateArr.forEach(date => {
            const dateString = Moment(date).format('DD-MM-YY');
            entry[dateString] = typeof(m.entries[dateString]) === 'undefined' ? 0 : m.entries[dateString][dimension]; 
        });

        return entry;
        //console.log(m);
    });
   console.log(extract[0]);
   return extract;
}
//Downloads all source data and creates the JSON summary file
async function initialize() {
    const files = await downloadHelper.downloadAll();
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
    //await update();
    //await makeCSV('confirmed');
};

execute();