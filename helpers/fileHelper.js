const csv = require('csvtojson');
const fs = require('fs').promises;
const moment = require('moment');

const parseCSV = async (file) => csv().fromFile('./data/source/csv/' + file);

const loadJSON = async function (file) {
  const data = await fs.readFile(file);
  return JSON.parse(data);
};

const saveJSON = async (filename, json) => fs.writeFile(filename, JSON.stringify(json));

const saveCSV = async (filename, csv) => fs.writeFile(filename, csv);

const getEndDate = async () => {
  const dir = await fs.readdir('./data/source/csv');
  let lastDate = moment('01-01-1990', 'DD-MM-YYYY');
  for (const dirent of dir) {
    const date = [dirent.slice(4, 6), dirent.slice(2, 4), dirent.slice(0, 2)].join('-');
    const procDate = moment(date, 'DD-MM-YY');
    if (procDate.isAfter(lastDate, 'day')) {
      lastDate = moment(procDate);
    }
  }

  lastDate.add(1, 'days');
  return lastDate;
}

exports.loadJSON = loadJSON;
exports.saveJSON = saveJSON;
exports.parseCSV = parseCSV;
exports.saveCSV = saveCSV;
exports.getEndDate = getEndDate;
