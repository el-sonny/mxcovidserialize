const downloadHelper = require('./helpers/downloadHelper.js');
const fileHelper = require('./helpers/fileHelper.js');
const dataHelper = require('./helpers/dataHelper.js');
const Moment = require('moment');
const csvConverter = require('json-2-csv');

async function getDateArray(start) {
    const arr = [];
    const dt = Moment(start);
    const end = await fileHelper.getEndDate();
    while (dt.isBefore(end, 'day')) {
        arr.push(Moment(dt));
        dt.add(1, 'days');
    }
    return arr;
};

//Downloads all source data and creates the JSON summary file
async function initialize() {
    const files = await downloadHelper.downloadAll();
    console.log(files);
    let timeSeries = await fileHelper.loadJSON('./data/municipios.json');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const date = [file.slice(4, 6), file.slice(2, 4), file.slice(0, 2)].join('-');
        const entries = await fileHelper.parseCSV(file);
        const summary = dataHelper.summarizeCases(entries, date);
        timeSeries = dataHelper.agregateDataDay(timeSeries, summary, date);
    };
    await fileHelper.saveJSON('./data/output/timeSeries.json', timeSeries);
};

//Downloads and processes only the latest date returns
async function update() {
    const file = await downloadHelper.download();
    if (!file) return;
    let timeSeries = await fileHelper.loadJSON('./data/output/timeSeries.json');
    const date = [file.slice(4, 6), file.slice(2, 4), file.slice(0, 2)].join('-');
    const entries = await fileHelper.parseCSV(file);
    const summary = dataHelper.summarizeCases(entries);
    timeSeries = dataHelper.agregateDataDay(timeSeries, summary, date);
    await fileHelper.saveJSON('./data/output/timeSeries.json', timeSeries);
};

async function makeCSV(dimension) {
    const timeSeries = await fileHelper.loadJSON('./data/output/timeSeries.json');
    const startDate = Moment('2020-04-13', 'YYYY-MM-DD');
    const dateArr = await getDateArray(startDate);
    const extract = timeSeries.map(m => {
        let entry = { ...m };
        delete entry.entries;
        dateArr.forEach(date => {
            const dateString = Moment(date).format('DD-MM-YY');
            entry[dateString] = typeof(m.entries[dateString]) === 'undefined' ? 0 : m.entries[dateString][dimension];
        });
        return entry;
    });
    
    const csv = await csvConverter.json2csvAsync(extract);
    return await fileHelper.saveCSV(`./data/output/csv/${dimension}-time-series.csv`, csv);
};

async function callGenerate(dim) {
    const availableDimensions = [
        'suspicious',
        'confirmed',
        'deaths',
        'recoveries',
        'negative',
        'active'
    ];

    if (!availableDimensions.includes(dim)) throw new Error('Invalid data dimension for CSV generate');

    makeCSV(dim)
};

async function getUSData() {
    const usDatasets = [{
            url: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv',
            filename: 'us_confirmed.csv',
            dimension: 'confirmed'
        },
        {
            url: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_US.csv',
            filename: 'us_deaths.csv',
            dimension: 'deaths'
        },
        {
            url: 'https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_county_population_usafacts.csv',
            filename: 'us_population.csv',
            dimension: 'population'
        }
    ]

    let usData = {};

    for (const dataSet of usDatasets) {
        console.log(dataSet);
        const { url, filename, dimension } = dataSet;
        await downloadHelper.downloadCSV(url, filename);

        const parsedFile = await fileHelper.parseCSV(filename);
        const data = dimension === 'population' ? dataHelper.getUSPopulation(parsedFile) : dataHelper.normalizeUSData(parsedFile);
        usData[dimension] = data;
    }

    await dataHelper.generateUSTimeSeries(usData);
    const USTimeSeries = await dataHelper.generateUSTimeSeries(usData);

    await fileHelper.saveJSON('./data/output/timeSeriesUS.json', USTimeSeries);
};

async function main(prcs) {
    if (prcs === 'initialize' || prcs === 'update') await getUSData();

    switch (prcs) {
        case 'initialize':
            await initialize();
            break;
        case 'update':
            update();
            break;
        case 'generate':
            const dim = process.argv[3];
            callGenerate(dim);
            break;
        default:
            throw new Error('Invalid action arg');
    }
};

if (process.argv.length < 3) {
  throw new Error('Expected at least one argument');
}

main(process.argv[2]);
