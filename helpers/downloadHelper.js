const Fs = require('fs');
const ProgressBar = require('progress');
const Axios = require('axios');
const DecompressZip = require('decompress-zip');
const moment = require('moment');

const downloadZip = async function (url) {
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
  const writer = Fs.createWriteStream('./temp/pkg.zip');
  data.on('data', (chunk) => progressBar.tick(chunk.length));
  data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  })
};

// Deflates temp/pkg.zip
const deflate = async function () {
  console.log('deflating');
  return new Promise((resolve, reject) => {
    const unzipper = new DecompressZip('./temp/pkg.zip');
    unzipper.on('extract', resolve);
    unzipper.on('error', reject);
    unzipper.extract({ path: './data/source/csv', restrict: false });
  });
};

//Downloads and Unzips the open data file for specified date, if none is specified then latest file is downloaded. Returns filename for unzipped file
//Date should be in this format: 12.04.2020
const download = async function (date) {
  const base = 'http://187.191.75.115/gobmx/salud/datos_abiertos/';
  const file = `historicos/datos_abiertos_covid19${date ? `_${date}` : ''}.zip`;
  await downloadZip(`${base}${file}`);
  const [{ deflated }] = await deflate();
  return deflated;
};

const downloadAll = async function () {
  let file;
  // THe first day that the Mexican Government started releasing data
  const files = [];
  const start = moment('2020-04-13', 'YYYY-MM-DD');
  const today = moment();
  const daysDiff = today.diff(start, 'days');
  for (let i = 0; i < daysDiff; i++) {
    const dateString = start.format('DD.MM.YYYY');
    console.log(dateString);
    file = await download(dateString);
    files.push(file);
    start.add(1, 'days');
  }
  console.log('Sale');
  file = await download();
  files.push(file);
  return files;
};

exports.download = download;
exports.downloadAll = downloadAll;