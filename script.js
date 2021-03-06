
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
    if (dataset == null) {
        return -1;
    }
    for (var i = 0; i < dataset.length; i++) {
        if (dataset[i].date == date) {
            return i;
        }
    }
    return -1;
}

/*
 * Return [date,S,I,R] from a given index,
 * or ["",-1,-1,-1] if the input was bad.
 */
function get_sir_from_index(population, dataset, index) {
    if (typeof(population) != "number" || typeof(dataset) != "object" || typeof(index) != "number") {
        return ["",-1,-1,-1]
    }
    if (dataset == null) {
        return ["",-1,-1,-1]
    }
    if (index < 0 || index > dataset.length-1) {
        return ["",-1,-1,-1]
    }
    let data = dataset[index];
    let sir = [];
    sir[0] = data.date;
    // susceptible
    sir[1] = population - data.confirmed - data.recovered;
    // infectious
    sir[2] = data.confirmed - data.recovered - data.deaths;
    // removed
    sir[3] = data.recovered + data.deaths;
    return sir;
}

/*
 * Returns an array of SIR data points between two dates (inclusive)
 * Returns [] if
 *     (1) any input is of the wrong type,
 *     (2) any date doesn't exist, or
 *     (3) if the start date comes after the end date.
 */
function get_sirs_between_dates(population, dataset, startDate, endDate) {
    if (dataset == null) {
        return [];
    }
    if (Date(startDate) > Date(endDate)) {
        return [];
    }
    // Note: we assume that the dates come in chronological order in
    // the JSON data, and this is true for the COVID-19 data.
    var startIndex = get_index_of_date(dataset, startDate);
    var endIndex   = get_index_of_date(dataset, endDate);
    if (startIndex == -1 || endIndex == -1) {
        return [];
    }
    var sirs = [];
    for (var i = startIndex; i <= endIndex; i++) {
        var sir = get_sir_from_index(population, dataset, i);
        sirs.push(sir);
    }
    return sirs;
}

/*
 * Input: parsed JSON data
 * Output: [date1, date2], or [] if anything goes wrong
 * Dates are a string YYYY-MM-DD (single-digit months and days not zero-padded).
 */
function get_start_and_end_date(dataset) {
    if (dataset == null ||
        typeof(dataset) != "object" ||
        dataset.length == undefined ||
        dataset[0].date == undefined ||
        dataset[dataset.length-1].date == undefined) {

        return [];
    }
    return [dataset[0].date, dataset[dataset.length-1].date];
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

/*
 * Input: a date string in the format YYYY-MM-DD (not zero-padded)
 * Output: the zero-padded date string, or "" if anything goes wrong.
 */
function pad_date(date_string) {
    if (typeof(date_string) != "string") {
        return "";
    }
    var parts = date_string.split("-");
    if (parts.length != 3) {
        return "";
    }
    if (parts[1].length == 1) {
        parts[1] = "0"+parts[1];
    }
    if (parts[2].length == 1) {
        parts[2] = "0"+parts[2];
    }
    return parts[0]+"-"+parts[1]+"-"+parts[2];
}

function remove_date_padding(padded_date) {
    var year = padded_date.slice(0,4);
    var month = padded_date.slice(5,7);
    var day = padded_date.slice(8,10);

    if(month.slice(0,1) === "0") {
        month = month.slice(1,2);
    }

    if(day.slice(0,1) === "0") {
        day = day.slice(1,2);
    }

    if(parseInt(year) < 2020 
        || (parseInt(month) < 2 && parseInt(day) < 22)) {
        return "2020-1-22";
    }

    return year + "-" + month + "-" + day;
}

function make_chart(sir_data) {

    if(sir_data === null) {
        return null;
    }

    var dates = [];
    var s_data = [];
    var i_data = [];
    var r_data = [];


    var i;
    for(i = 0; i < sir_data.length; i++) {
        dates.push(sir_data[i][0]);
        s_data.push(sir_data[i][1]);
        i_data.push(sir_data[i][2]);
        r_data.push(sir_data[i][3]);
    }

    var chart = {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: "susceptible",
                hidden: true,
                borderColor: "green",
                data: s_data
            },
            {
                label: "infected",
                borderColor: "red", 
                data: i_data
            },
            {
                label: "removed",
                hidden: true,
                borderColor: "blue", 
                data: r_data
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: true,
            legend: {
                labels: {
                    fontColor: "white"
                }
            },
            scales: {
                yAxes: [{
                    ticks: {
                        fontColor: "white",
                    }
                }],
                xAxes: [{
                    ticks: {
                        fontColor: "white",
                    }
                }]
            }
        }
    };

    return chart;
}

function s_change(b, S, I) {
    return S + (-b * (S * I));
}

function i_change(g, b, S, I, R) {
    return I + (b * S * I - (g * I));
}

function r_change(g, I, R) {
    return R + (g * I);
}

function make_prediction(sir_data, extra_days, past_days) {
    if(sir_data.length < 2) {
        return [];
    }

    var i;

    if(past_days > sir_data.length) {
        past_days = sir_data.length;
    }
    if(past_days < 2) {
        past_days = 2;
    }

    var bs = [];
    var gs = [];

    for(i = 0; i < past_days; i++) {
        var s0 = sir_data[sir_data.length-(i+2)][1];
        var s1 = sir_data[sir_data.length-(i+1)][1];
        var i0 = sir_data[sir_data.length-(i+2)][2];
        var r0 = sir_data[sir_data.length-(i+2)][3];
        var r1 = sir_data[sir_data.length-(i+1)][3];

        bs.push((s0-s1)/(s0*i0));
        gs.push((r1-r0)/i0);
    }

    var b_sum = 0;
    var g_sum = 0;
    for(i = 0; i < past_days; i++) {
        b_sum += bs[i];
        g_sum += gs[i];
    }

    var b = b_sum/past_days;
    var g = g_sum/past_days;

    var prediction = sir_data;

    var last_sir_date = sir_data[sir_data.length-1][0];
    var last_sir_index = sir_data.length-1;
    var last_prediction_index = last_sir_index + extra_days;

    for(i = last_sir_index; i < last_prediction_index; i++) {
        var sprev = prediction[i][1];
        var iprev = prediction[i][2];
        var rprev = prediction[i][3];
        prediction.push([addDays(last_sir_date, (i-last_sir_index)+1),
            Math.floor(s_change(b,sprev,iprev)),
            Math.floor(i_change(g, b, sprev,iprev,rprev)),
            Math.floor(r_change(g,iprev,rprev))]);
    }

    return prediction;
}

function days_between_dates(date1, date2) {

    if(date1 == null || date2 == null) {
        return 0;
    }

    date1 = date1.split("-");
    var firstDate = Date.UTC(
        parseInt(date1[0]),
        parseInt(date1[1])-1,
        parseInt(date1[2]));

    date2 = date2.split("-");
    var secondDate = Date.UTC(
        parseInt(date2[0]),
        parseInt(date2[1]-1),
        parseInt(date2[2]));

    const oneDay = 24 * 60 * 60 * 1000;

    var result = Math.round((secondDate - firstDate) / oneDay);
    return result;
}

function addDays(date, days) {
    var result = new Date(date);
    result.setDate(result.getDate() + days);
    result = result.getFullYear() + "-" + 
    (result.getMonth()+1) + "-" + (result.getDate());    
    return result;
}

function get_max_infected(sir_data) {
    if(sir_data == null) {
        return null;
    }

    var max_infected = 0;

    var extra_days = 365;
    var prediction = make_prediction(sir_data, extra_days, 30);
    var i;

    for (i = 0; i < prediction.length; i++) {
        if (prediction[i][2] > max_infected) {
            max_infected = prediction[i][2];
        }
    }

    return max_infected;
}

async function updateHTML() {
    var previous_start_date;
    var previous_end_date;

    function save_dates() {
        previous_start_date = document.getElementById("start-date").value;
        previous_end_date   = document.getElementById("end-date").value;
    }

    // Set the date inputs to the previous correct ones.
    function reset_dates() {
        document.getElementById("start-date").value = previous_start_date;
        document.getElementById("end-date").value   = previous_end_date;
    }

    try {
        var ctx = document.getElementById('chart').getContext('2d');

        var pop = (await url_to_json(url_to_population_data))[0].population;
        var json = await url_to_json(url_to_covid_data);
        var dataset = json.Sweden;

        var dates = get_start_and_end_date(dataset);
        document.getElementById("start-date").value = pad_date(dates[0]);
        document.getElementById("end-date").value   = pad_date(addDays(dates[1], 29));
        save_dates();

        var two_days_ago = new Date();
        two_days_ago = addDays(two_days_ago, -2);
        
        var sir_data = get_sirs_between_dates(pop, dataset, dates[0], two_days_ago);
        var max_infected = get_max_infected(sir_data);
        var infected_line = "If current trends continue the maximum number of simultaneously infected individuals will be: ";
        document.getElementById("max_infected").innerHTML = infected_line + max_infected;
        sir_data = get_sirs_between_dates(pop, dataset, dates[0], two_days_ago);
        var prediction = make_prediction(sir_data, 30, 30);
        var chart = make_chart(prediction);
        var lineChart = new Chart(ctx, chart);

        document.getElementById("date-button").addEventListener("click", function(){
            var start_date = document.getElementById("start-date").value;
            var end_date = document.getElementById("end-date").value;

            var parsed_start = Date.parse(start_date);
            var parsed_end   = Date.parse(end_date);
            if (parsed_start == NaN || parsed_end == NaN) {
                // Actually, this should never happen because the date
                // picker input doesn't allow for arbitrary strings.
                reset_dates();
            } else if (parsed_start < Date.parse(dates[0])) {
                reset_dates();
            } else if (parsed_start > parsed_end) {
                reset_dates();
            } else {
                lineChart.destroy();
                save_dates();
                start_date = remove_date_padding(start_date);
                if(days_between_dates(two_days_ago, end_date) < 0) {
                    sir_data = get_sirs_between_dates(pop, dataset, start_date, remove_date_padding(end_date));
                    prediction = sir_data;
                }
                else { 
                    sir_data = get_sirs_between_dates(pop, dataset, start_date, two_days_ago);
                    var extra_days = days_between_dates(two_days_ago, end_date);
                    prediction = make_prediction(sir_data, extra_days, 30);
                }

                chart = make_chart(prediction);
                lineChart = new Chart(ctx, chart);
            }
        });
    }
    catch (error) {}
}

module.exports = {
    url_to_covid_data, url_to_population_data, url_to_json,
    get_sir_from_index, get_population, get_index_of_date,
    make_chart, get_sirs_between_dates, get_start_and_end_date, 
    make_prediction, remove_date_padding, pad_date, 
    days_between_dates, get_max_infected
}

updateHTML();



