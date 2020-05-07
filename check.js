const fileHelper = require('./helpers/fileHelper.js');
const Moment = require('moment');

async function check() {
  const timeSeries = await fileHelper.loadJSON('./data/output/timeSeries.json');

  console.log(timeSeries[1]);

  const lastDayStr = Moment().subtract(1, 'days').format('DD-MM-YY');

  const finalData = timeSeries.reduce((acc, it, ind) => {
    const { entries } = it;
    const municipalityEntries = Object.keys(entries);

    if (!Array.isArray(municipalityEntries) || municipalityEntries.length === 0) return acc;

    const lastDayData = entries[lastDayStr] || {
      total: 0,
      suspicious: 0,
      confirmed: 0,
      deaths: 0,
      recoveries: 0,
      negative: 0,
      active: 0
    };

    // const lastDayData = entries[municipalityEntries[municipalityEntries.length - 1]];

    const total = acc.total + lastDayData.total;
    const suspicious = acc.suspicious + lastDayData.suspicious;
    const confirmed = acc.confirmed + lastDayData.confirmed;
    const deaths = acc.deaths + lastDayData.deaths;
    const recoveries = acc.recoveries + lastDayData.recoveries;
    const negative = acc.negative + lastDayData.negative;
    const active = acc.active + lastDayData.active;

    return {
      total,
      suspicious,
      confirmed,
      deaths,
      recoveries,
      negative,
      active
    }
  }, {
    total: 0,
    suspicious: 0,
    confirmed: 0,
    deaths: 0,
    recoveries: 0,
    negative: 0,
    active: 0
  });

  console.log(finalData);
}

check();