const downloadHelper = require('./helpers/downloadHelper.js');
const fileHelper = require('./helpers/fileHelper.js');
const dataHelper = require('./helpers/dataHelper.js');
const Moment = require('moment');

function getDateArray(start, end) {
    let arr = new Array();
    let dt = new Date(start);
    while (dt <= end) {
        arr.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
};            

//Downloads all source data and creates the JSON summary file
async function initialize() {
    const files = await downloadHelper.downloadAll();
    let timeSeries = await fileHelper.loadJSON('./data/municipios.json');
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        const date = [file.slice(4, 6), file.slice(2, 4), file.slice(0, 2)].join('-');
        const entries = await fileHelper.parseCSV(file);
        const summary = dataHelper.summarizeCases(entries);
        timeSeries = dataHelper.agregateDataDay(timeSeries, summary, date);
    };
    await fileHelper.saveJSON('./data/output/timeSeries.json', timeSeries);
};

//Downloads and processes only the latest date returns
async function update() {
    const file = await downloadHelper.download();
    let timeSeries = await fileHelper.loadJSON('./data/output/timeSeries.json');
    const date = [file.slice(4, 6), file.slice(2, 4), file.slice(0, 2)].join('-');
    const entries = await fileHelper.parseCSV(file);
    const summary = dataHelper.summarizeCases(entries);
    timeSeries = dataHelper.agregateDataDay(timeSeries, summary, date);
    await fileHelper.saveJSON('./data/output/timeSeries.json', timeSeries);
};

async function makeCSV(dimension) {
    console.log(dimension);
    const timeSeries = await fileHelper.loadJSON('./data/output/timeSeries.json');
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
};

async function execute() {
    await initialize();
    //await update();
    //await makeCSV('confirmed');
};

execute();