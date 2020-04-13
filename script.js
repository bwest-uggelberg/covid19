
const fetch = require("node-fetch");
const url_to_covid_data = "https://pomber.github.io/covid19/timeseries.json";
const url_to_population_data = "https://restcountries.eu/rest/v2/name/sweden";


async function url_to_json(url) {
	try {
    	const response = await fetch(url);
    	const data = await response.json();
		return data;
	} catch (error) {
		// Bad URL or malformed JSON
		return null;
	}
}

/*
 * Find where the date is inside the dataset.
 * Returns -1 if not found or the input is wrong.
 */
function get_index_of_date(dataset, date) {
    for (var i = 0; i < dataset.length; i++) {
        if (dataset[i].date == date) {
            return i;
        }
    }
    return -1;
}

/*
 * Below is the format of date. HOWEVER! The month and day is not
 * padded to be two digits.
 * Input: "YYYY-MM-DD"
 * Output: [S,I,R], or [-1,-1,-1] if the input was bad.
 */
function get_sir_from_date(population, data_set, date) {
    for (var i = 0; i < data_set.length; i++) {
		let day_data = data_set[i];
        if (day_data.date == date) {
            let sir = [];
            // susceptible
            sir[0] = population - day_data.confirmed - day_data.recovered;
            // infectious
            sir[1] = day_data.confirmed;
            // removed
            sir[2] = day_data.recovered;
            return sir;
        }
    }
    return [-1,-1,-1];
}

/*
 * Input: parsed JSON data
 * Output: the population, or -1 if anything goes wrong
 */
function get_population(data) {
    if (data === null)  return -1;
    if (data.length == 0)  return -1;
    if (data[0].population === undefined)  return -1;
    return data[0].population;
}

module.exports = {
    url_to_covid_data, url_to_population_data, url_to_json,
    get_sir_from_date, get_population, get_index_of_date
}


async function changeText() {
	try {
		document.getElementById("data").innerHTML = "Data from JS";
	}
	catch (error) {}
}

changeText();
