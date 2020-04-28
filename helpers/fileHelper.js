const csv = require('csvtojson');
const fs = require('fs').promises;

const parseCSV = async function(file) {
    return csv().fromFile('./data/source/csv/' + file);
};

const loadJSON = async function(file) {
    const data = await fs.readFile(file);
    return JSON.parse(data);
};

const saveJSON = async function(filename, json) {
    return fs.writeFile(filename, JSON.stringify(json));
};

const saveCSV = async (filename, csv) => fs.writeFile(filename, csv);

exports.loadJSON = loadJSON;
exports.saveJSON = saveJSON;
exports.parseCSV = parseCSV;
exports.saveCSV = saveCSV;