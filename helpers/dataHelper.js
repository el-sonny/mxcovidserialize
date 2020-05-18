const moment = require('moment');
const fs = require('./fileHelper');

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

const getUSPopulation = (csvEntries) => {
  const result = csvEntries.reduce((acc, it) => {
    const { countyFIPS: fips, population: popStr, State: state } = it;
    const population = parseInt(popStr, 10);

    const name = it['County Name'];

    return { ...acc, [fips]: { fips, name, state, population } };
  }, {});

  return result;
}

const normalizeUSData = (csvEntries) => {
  const result = csvEntries.reduce((acc, it) => {
    // console.log(Object.entries(acc).length);
    const {
      // Useful keys
      FIPS,
      Lat,
      Long_,
      Population,
      Province_State: state,

      // Destructuring this keys so we can use the rest operator
      // to group all the days into one object
      UID,
      iso2,
      iso3,
      code3,
      Admin2,
      County_Region,
      Combined_Key,
      Country_Region,

      // Object with the days as keys and amount of cases as values
      ...days
    } = it;


    const lat = parseFloat(Lat);
    const lon = parseFloat(Long_);
    const population = parseInt(Population, 10);
    const fips = FIPS.replace('.0', '');

    // Most Complex Alternative to destructuring and rest operator

    // const daysArr = Object.keys(it).filter(k => k.match(^(1[0-2]|[1-9])\/([1-9]|([12]\d+)|(3[01]))\/20$);
    // const daysObj = daysArr.reduce((acc, d) => {
    //   const cases = it[d];
    //   return { ...acc, [d]: cases}
    // })

    return { ...acc, [fips]: { fips, lat, lon, population, state, entries: days } }
  }, {});

  return result
}

const generateUSTimeSeries = async (data) => {
  const usCounties = await fs.parseCSV('countiesfpis.csv');
  const { confirmed, deaths, population } = data;

  const result = usCounties.map(county => {
    const { fips, county: name, state } = county;
    const confirmedCounty = confirmed[fips];
    const deathsCounty = deaths[fips];
    const populationCounty = population[fips];

    const confirmedDays = Object.keys(confirmedCounty.entries);
    const deathsDays = Object.keys(deathsCounty.entries);
    const daysToProcess = new Set([...confirmedDays, ...deathsDays]);
    const setIterator = daysToProcess.values();
    let entries = {};
    for (let it of setIterator) {
      const conf = parseInt(confirmedCounty.entries[it], 10);
      const death = parseInt(deathsCounty.entries[it], 10);
      entries[it] = { confirmed: conf, deaths: death };
    }

    return {
      fips,
      entries,
      name: populationCounty.name || name,
      lat: confirmedCounty.lat || deathsCounty.lat,
      lon: confirmedCounty.lon || deathsCounty.lon,
      population: deathsCounty.population || populationCounty.population,
      state: populationCounty.state || confirmedCounty.state || deathsCounty.state || state
    };
  })

  return result;
};

exports.summarizeCases = summarizeCases;
exports.agregateDataDay = agregateDataDay;
exports.getUSPopulation = getUSPopulation;
exports.normalizeUSData = normalizeUSData;
exports.generateUSTimeSeries = generateUSTimeSeries;