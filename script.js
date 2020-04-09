const fetch = require("node-fetch");

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
    // foooooooo
    // BAR!
}

module.exports = {
    url_to_json, get_sir_from_date, get_population
}
