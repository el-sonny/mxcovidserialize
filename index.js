const downloadHelper = require('./helpers/downloadHelper.js');
const fileHelper = require('./helpers/fileHelper.js');
const dataHelper = require('./helpers/dataHelper.js');
const Moment = require('moment');
const csvConverter = require('json-2-csv');

function getDateArray(start, end) {
  const arr = [];
  const dt = Moment(start);
  while (dt.isBefore(end)) {
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
  const endDate = Moment('2020-05-05', 'YYYY-MM-DD');
  const dateArr = getDateArray(startDate, endDate);
  const extract = timeSeries.map(m => {
    let entry = { ...m };
    delete entry.entries;
    dateArr.forEach(date => {
      const dateString = Moment(date).format('DD-MM-YY');
      entry[dateString] = typeof (m.entries[dateString]) === 'undefined' ? 0 : m.entries[dateString][dimension];
    });

    return entry;
  });
  const csv = await csvConverter.json2csvAsync(extract);
  return await fileHelper.saveCSV(`./data/output/csv/${dimension}-time-series.csv`, csv);
};

async function callGenerate(dim) {
  if (dim !== 'confirmed' && dim !== 'deaths') throw new Error('Invalid data dimension for CSV generate');
  makeCSV(dim)
};

if (process.argv.length < 3) {
  throw new Error('Expected at least one argument');
}

const prcs = process.argv[2];

switch (prcs) {
  case 'initialize':
    initialize();
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