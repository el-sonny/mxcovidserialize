const moment = require('moment');

const agregate = function (entry, currentData, date) {
  let newData = { ...currentData };
  newData.total += 1;
  const fileDate = moment(date, 'DD-MM-YY');

  if (entry.RESULTADO === '1') {
    newData.confirmed += 1;
    if (entry.FECHA_DEF !== '9999-99-99' && entry.FECHA_DEF !== '') {
      newData.deaths += 1;
    } else {
      const start = moment(entry.FECHA_INGRESO);
      const daysDiff = fileDate.diff(start, 'days');
      (daysDiff >= 14) ? newData.recoveries += 1 : newData.active += 1;
    }
  }
  if (entry.RESULTADO === '2') newData.negative += 1;

  if (entry.RESULTADO === '3') newData.suspicious += 1;

  return newData;
};

const agregateDataDay = function (original, summary, date) {
  const timeSeries = original.map(m => {
    if (typeof m.entries === 'undefined') m.entries = {};
    const key = `${m.entityCode}${m.municipalityCode}`;
    m.entries[date] = summary[key];
    return m;
  });
  return timeSeries;
};

// Sums and counts each type of case *Active and Recovered data is not accurate needs to be checked
const summarizeCases = function (entries, date) {
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
    municipalities[compoundKey] = agregate(entry, municipalities[compoundKey], date);
  });
  return municipalities;
};

exports.summarizeCases = summarizeCases;
exports.agregateDataDay = agregateDataDay;