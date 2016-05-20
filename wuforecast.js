/* global Module */

/* Magic Mirror
 * Module: WUForecast
 *
 * By Matthew Fields
 *
 * Modified from WeatherForecast by Michael Teeuw 
 * MIT Licensed.
 */

Module.register("wuforecast",{

	// Default module config.
	defaults: {
		location: "",
		appid: "",
		units: config.units,
		maxNumberOfDays: 7,
		updateInterval: 15 * 60 * 1000, // every 15 minutes
		animationSpeed: 1000,
		timeFormat: config.timeFormat,
		lang: config.language,
		fade: true,
		degreeSym: true,
		pop: true,
		iconSet: "k",
		fadePoint: 0.25, // Start on 1/4th of the list.

		initialLoadDelay: 2500, // 2.5 seconds delay. This delay is used to keep the wunderground API happy.
		retryDelay: 2500,

		apiBase: "http://api.wunderground.com/api/",
		forecastEndpoint: "/forecast10day/q/",

                iconTable: {
                        "chanceflurries": "wi-day-snow-wind",
                        "chancerain": "wi-day-showers",
                        "chancesleet": "wi-day-sleet",
                        "chancesnow": "wi-day-snow",
                        "chancetstorms": "wi-day-storm-showers",
                        "clear": "wi-day-sunny",
                        "cloudy": "wi-cloud",
                        "flurries": "wi-snow-wind",
                        "fog": "wi-fog",
                        "haze": "wi-day-haze",
                        "mostlycloudy": "wi-cloudy",
                        "mostlysunny": "wi-day-sunny-overcast",
                        "partlycloudy": "wi-day-cloudy",
                        "partlysunny": "wi-day-cloudy-high",
			"rain": "wi-rain",
                        "sleet": "wi-sleet",
                        "snow": "wi-snow",
                        "tstorms": "wi-thunderstorm"
                },


	},

	// Define required scripts.
	getScripts: function() {
		return ["moment.js"];
	},

	// Define required scripts.
	getStyles: function() {
		return ["wuforecast.css"];
	},

	// Define required translations.
	getTranslations: function() {
		// The translations for the defaut modules are defined in the core translation files.
		// Therefor we can just return false. Otherwise we should have returned a dictionary.
		// If you're trying to build your own module including translations, check out the documentation.
		return false;
	},

	// Define start sequence.
	start: function() {
		Log.info("Starting module: " + this.name);

		// Set locale.
		moment.locale(this.config.lang);

		this.forecast = [];
		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);
		this.iconText = null;

		this.updateTimer = null;
		this.degSymbol = null;

	},

	// Override dom generator.
	getDom: function() {
		var wrapper = document.createElement("div");

		if (this.config.appid === "") {
			wrapper.innerHTML = "Please set the correct wunderground <i>appid</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (this.config.location === "") {
			wrapper.innerHTML = "Please set the wunderground <i>location</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (!this.loaded) {
			wrapper.innerHTML = this.translate('LOADING');
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		var table = document.createElement("table");
		table.className = "small";

		for (var f in this.forecast) {
			var forecast = this.forecast[f];

			var row = document.createElement("tr");
			table.classname = "row";
			table.appendChild(row);

			var dayCell = document.createElement("td");
			dayCell.className = "day";
			dayCell.innerHTML = forecast.day;
			row.appendChild(dayCell);

                        var popCell = document.createElement("td");
			popCell.className = "align-right pop";
                        if (forecast.pop > 0 && this.config.pop) {
                                popCell.innerHTML = "  <sup>" + forecast.pop + "%</sup>";
                        }
                        row.appendChild(popCell);

			var iconCell = document.createElement("td");
			iconCell.className = "align-center bright weather-icon";
			row.appendChild(iconCell);

			var icon = document.createElement("span");
			icon.className = forecast.icon;
			iconCell.appendChild(icon);

			// Set the degree symbol if desired
			if (this.config.degreeSym) {
				degSymbol = "&deg;";
			}

			var maxTempCell = document.createElement("td");
			if (this.config.units === "imperial") {
				maxTempCell.innerHTML = forecast.maxTemp + degSymbol;
			} else if (this.config.units === "metric") {
				maxTempCell.innerHTML = forecast.maxTempC + degSymbol;
			} else {
				maxTempCell.innerHTML = forecast.maxTempC + 273 + degSymbol;
			}
			maxTempCell.className = "align-right bright max-temp";
			row.appendChild(maxTempCell);

			var minTempCell = document.createElement("td");
                        if (this.config.units === "imperial") {
                                minTempCell.innerHTML = forecast.minTemp + degSymbol;
                        } else if (this.config.units === "metric") {
                                minTempCell.innerHTML = forecast.minTempC  + degSymbol;
                        } else {
                                minTempCell.innerHTML = forecast.minTempC + 273 + degSymbol;
                        }
			minTempCell.className = "align-right min-temp";
			row.appendChild(minTempCell);

			if (this.config.fade && this.config.fadePoint < 1) {
				if (this.config.fadePoint < 0) {
					this.config.fadePoint = 0;
				}
				var startingPoint = this.forecast.length * this.config.fadePoint;
				var steps = this.forecast.length - startingPoint;
				if (f >= startingPoint) {
					var currentStep = f - startingPoint;
					row.style.opacity = 1 - (1 / steps * currentStep);
				}
			}

		}

		return table;
	},

	/* updateWeather(compliments)
	 * Requests new data from wunderground.com.
	 * Calls processWeather on succesfull response.
	 */
	updateWeather: function() {
		var url = this.config.apiBase + this.config.appid + this.config.forecastEndpoint + this.config.location + ".json";
		var self = this;

		var retry = true;

		var weatherRequest = new XMLHttpRequest();
		weatherRequest.open("GET", url, true);
		weatherRequest.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					try {
						var parsed = JSON.parse(this.response);
					}catch(e){
						console.log("weatherforecast - JSON error: " + e.name);
						self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
						return;
						// here to prevent freezin of app on unfinished JSON.
					}
					self.processWeather(parsed);
				} else if (this.status === 401) {
					self.config.appid = "";
					self.updateDom(self.config.animationSpeed);

					Log.error(self.name + ": Incorrect APPID.");
					retry = false;
				} else {
					Log.error(self.name + ": Could not load weather.");
				}

				if (retry) {
					self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
				}
			}
		};
		weatherRequest.send();
	},

	/* processWeather(data)
	 * Uses the received data to set the various values.
	 *
	 * argument data object - Weather information received form wunderground.
	 */
	processWeather: function(data) {

		this.forecast = [];
		for (var i = 0, count = Math.min(data.forecast.simpleforecast.forecastday.length, this.config.maxNumberOfDays); i < count; i++) {
			
			var forecast = data.forecast.simpleforecast.forecastday[i];
			this.forecast.push({

				day: moment(forecast.date.epoch, "X").format("ddd"),
//				icon: forecast.icon_url,
                                icon: this.config.iconTable[forecast.icon],
				pop: forecast.pop,
				maxTemp: this.roundValue(forecast.high.fahrenheit),
				minTemp: this.roundValue(forecast.low.fahrenheit),
				maxTempC: this.roundValue(forecast.high.celsius),
				minTempC: this.roundValue(forecast.low.celsius)

			});
		}

		this.loaded = true;
		this.updateDom(this.config.animationSpeed);
	},

	/* scheduleUpdate()
	 * Schedule next update.
	 *
	 * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
	 */
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;
		clearTimeout(this.updateTimer);
		this.updateTimer = setTimeout(function() {
			self.updateWeather();
		}, nextLoad);
	},

	/* function(temperature)
	 * Rounds a temperature a whole number.
	 *
	 * argument temperature number - Temperature.
	 *
	 * return number - Rounded Temperature.
	 */
	roundValue: function(temperature) {
		return Math.round(temperature);
	}
});
