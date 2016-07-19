'use strict';

var request = require('request');
var prompt = require('prompt');

var args = process.argv.slice(2);// remove command and filename
var IMEI = args[0];
var phoneNumber = args[1];
var email = args[2];
var password = args[3];
var operator = args[4];

if (IMEI == null || phoneNumber == null || email == null || password == null || operator == null)
{
	console.log("args:IMEI phoneNumber email password operator(airtel,idea)");
	process.exit(1);
}

var trackerEngineIP = "tracker.smartsense.co.in:7326/";
var appEngineIP = "app.smartsense.co.in:7322/"

var agentOptions = {};

var SSL_ENABLED = 1;
var HTTPS_PREFIX = "";
if (SSL_ENABLED)
{
	HTTPS_PREFIX = "s";
	var trackerEngineIP = "tracker.smartsense.co.in:7336/";
	var appEngineIP = "app.smartsense.co.in:7332/"
}
if (process.env.NODE_ENV === 'dev')
{
	trackerEngineIP = "localhost:7326/";
	appEngineIP = "localhost:7322/"

	if (SSL_ENABLED)
	{
		HTTPS_PREFIX = "s";
		trackerEngineIP = "localhost:7336/";
		appEngineIP = "localhost:7332/"
		// since we are using self signed certs in dev
		agentOptions = {
			rejectUnauthorized : false
		};
	}
}

var initURL = "http" + HTTPS_PREFIX + "://" + trackerEngineIP + "tracker/register";
var registerURL = "http" + HTTPS_PREFIX + "://" + appEngineIP + "tracker/register/user";
var loginURL = "http" + HTTPS_PREFIX + "://" + trackerEngineIP + "tracker/login";
var dataURL = "http" + HTTPS_PREFIX + "://" + trackerEngineIP + "tracker/data";
var userLoginURL = "http" + HTTPS_PREFIX + "://" + appEngineIP + "user/login";
var self = this;

console.log("USER LOGIN.....");
console.log("Executing POST:%s", userLoginURL);
request.post({
	url : userLoginURL,
	json : {
		email : email,
		password : password
	},
	agentOptions : agentOptions
}, function(error, response, body)
{
	if (!error && response.statusCode == 200)
	{
		var params = JSON.parse(response.body);
		self.userToken = params.token;
		self.userID = params.id;
		console.log("User login accepted.")
		console.log("TRACKER INITIALIZATION.....");
		console.log("Executing POST:%s", initURL);
		// kick off registration
		request.post({
			url : initURL,
			json : {
				imei : IMEI
			},
			agentOptions : agentOptions
		}, function(error, response, body)
		{
			if (!error && response.statusCode == 200)
			{
				console.log("Initialization accepted, TRACKER REGISTRATION with userID:%s on URL:%s with token:%s", self.userID, registerURL, self.userToken);
				request.post({
					url : registerURL,
					json : {
						phoneNumber : phoneNumber,
						imei : IMEI,
						operator : operator
					},
					headers : {
						userid : self.userID,
						token : self.userToken
					},
					agentOptions : agentOptions
				}, function(error, response, body)
				{
					if (!error && response.statusCode == 200)
					{
						var userTrackerPairID = body.userTrackerPairID;
						console.log("Registration accepted");
						console.log("Please type in the TID you get via SMS on the phone number:%s", phoneNumber);
						prompt.start();

						prompt.get([ 'TID' ], function(err, result)
						{

							request.post({
								url : loginURL,
								json : {
									TID : result.TID
								},
								agentOptions : agentOptions
							}, function(error, response, body)
							{
								if (!error && response.statusCode == 200)
								{
									// var responseParams =
									// JSON.parse(response.body);
									console.log("Login successful!");
									startPrompt(result.TID);
								} else
								{
									console.log("Login didn't work");
									console.log("ERROR:%s", error);
									console.log("STATUSCODE:%s", response && response.statusCode);
									console.log("BODY:%s", response.body && response.body);
								}
							});
						});

					} else
					{
						console.log("Registration didn't work");
						console.log("ERROR:%s", error);
						console.log("STATUSCODE:%s", response && response.statusCode);
						console.log("BODY:%s", response.body && response.body);
					}

				});
			} else
			{
				console.log("Registration didn't work");
				console.log("ERROR:%s", error);
				console.log("STATUSCODE:%s", response && response.statusCode);
				console.log("BODY:%s", response.body && response.body);
			}
		});

	} else
	{
		console.log("ERROR:%s", error);
		console.log("STATUSCODE:%s", response && response.statusCode);
		console.log("BODY:%s", response.body && response.body);
	}
});

function getDate()
{
	return new Date().toISOString().replace(/\.\d\d\dZ/, '') + '+05:30';
}

function startPrompt(trackerID)
{
	console.log("your wish is my command....");
	console.log("Allowable actions:IVR,IVF,location,ackStartLiveTrack,ackStopLiveTrack,ackStopSOS,ackGetLoc,ackConfig");
	prompt.start();

	prompt.get([ 'command' ], function(err, result)
	{
		console.log("command:%s", result.command);
		var command = result.command;
		if (command === 'IVR' || command === 'IVF')
		{
			var opts = {
				ALERT : command,
				Ops : "M",
				TID : trackerID,
				DateTime : getDate(),
				LatLng : "100.1,100,2",
				SpeedAlti : "0.0,0.0",
				Battery : 355,
				Net : "1",
			};
			console.log("Registering %s with cloud on URL:%s and options:%s", command, dataURL, JSON.stringify(opts));
			request.post({
				url : dataURL,
				json : opts,
				agentOptions : agentOptions
			}, function(error, response, body)
			{
				if (error || response.statusCode != 200)
				{
					console.log("Error registering panic button press.")
				} else
				{
					console.log("Registered panic button press successfully!");
				}
				startPrompt(trackerID);
			});
		} else if (command === 'location')
		{
			var readline = require('readline');

			var rl = readline.createInterface({
				input : process.stdin,
				output : process.stdout
			});

			rl.question("Please type in location:LAT,LONG,SPEED,ALTI,isLocationGPSDerived(0 or 1),BLV(battery level ie 345),REG/HBT\n", function(answer)
			{
				rl.close();
				var params = answer.split(",");
				var gpsDerived = "1";// implies LBS
				if (params[4] === "1")
					gpsDerived = "2";// implies GPS

				var opts = {

					TID : trackerID,
					LatLng : params[0] + "," + params[1],
					SpeedAlti : params[2] + "," + params[3],
					DateTime : getDate(),
					ALERT : params[6],
					Battery : params[5],
					Ops : "A",
					Net : gpsDerived,

				};

				console.log("Registering location update with cloud on URL:%s and options:%s", dataURL, JSON.stringify(opts));
				request.post({
					url : dataURL,
					json: opts,
					agentOptions : agentOptions
				}, function(error, response, body)
				{
					if (error || response.statusCode != 200)
					{
						console.log("Error registering location update.")
					} else
					{
						console.log("Registered location update successfully!");
					}
					startPrompt(trackerID);
				});
			});
		} else if (command === 'ackStartLiveTrack')
		{
			var opts = {
				TID : trackerID,
				DateTime : getDate(),
				ALERT : "OK1",
				LatLng : "100.1,100,2",
				SpeedAlti : "0.0,0.0",
				Battery : 355,
				Ops : "A",
				Net : "1",

			};
			console.log("Registering ack start live track with cloud on URL:%s and options:%s", dataURL, JSON.stringify(opts));
			request.post({
				url : dataURL,
				json : opts,
				agentOptions : agentOptions
			}, function(error, response, body)
			{
				if (error || response.statusCode != 200)
				{
					0
					console.log("Error acking start live track.")
				} else
				{
					console.log("Acked start live track!");
				}
				startPrompt(trackerID);
			});
		} else if (command === 'ackStopLiveTrack')
		{
			var opts = {
				TID : trackerID,
				DateTime : getDate(),
				ALERT : "OK2",
				LatLng : "100.1,100,2",
				SpeedAlti : "0.0,0.0",
				Battery : 355,
				Ops : "A",
				Net : "1",
			};
			console.log("Registering ack stop live track with cloud on URL:%s and options:%s", dataURL, JSON.stringify(opts));
			request.post({
				url : dataURL,
				json : opts,
				agentOptions : agentOptions
			}, function(error, response, body)
			{
				if (error || response.statusCode != 200)
				{
					console.log("Error acking stop live track.")
				} else
				{
					console.log("Acked stop live track!");
				}
				startPrompt(trackerID);
			});
		} else if (command === 'ackStopSOS')
		{
			var opts = {
				TID : trackerID,
				DateTime : getDate(),
				ALERT : "OK3",
				LatLng : "100.1,100,2",
				SpeedAlti : "0.0,0.0",
				Battery : 355,
				Ops : "A",
				Net : "1",
			};
			console.log("Registering ack stop sos with cloud on URL:%s and options:%s", dataURL, JSON.stringify(opts));
			request.post({
				url : dataURL,
				json : opts,
				agentOptions : agentOptions
			}, function(error, response, body)
			{
				if (error || response.statusCode != 200)
				{
					console.log("Error acking stop sos.")
				} else
				{
					console.log("Acked stop sos!");
				}
				startPrompt(trackerID);
			});

		} else if (command === 'ackGetLoc')
		{
			var opts = {
				TID : trackerID,
				DateTime : getDate(),
				ALERT : "OK4",
				LatLng : "100.1,100,2",
				SpeedAlti : "0.0,0.0",
				Battery : 355,
				Ops : "A",
				Net : "1",
			};
			console.log("Registering ack get loc with cloud on URL:%s and options:%s", dataURL, JSON.stringify(opts));
			request.post({
				url : dataURL,
				json : opts,
				agentOptions : agentOptions
			}, function(error, response, body)
			{
				if (error || response.statusCode != 200)
				{
					console.log("Error acking get loc.")
				} else
				{
					console.log("Acked get loc!");
				}
				startPrompt(trackerID);
			});

		} else if (command === 'ackConfig')
		{
			var opts = {
				TID : trackerID,
				DateTime : getDate(),
				ALERT : "OK5",
				LatLng : "100.1,100,2",
				SpeedAlti : "0.0,0.0",
				Battery : 355,
				Ops : "A",
				Net : "1",
			};
			console.log("Registering ack config with cloud on URL:%s and options:%s", dataURL, JSON.stringify(opts));
			request.post({
				url : dataURL,
				json : opts,
				agentOptions : agentOptions
			}, function(error, response, body)
			{
				if (error || response.statusCode != 200)
				{
					console.log("Error acking config.")
				} else
				{
					console.log("Acked config!");
				}
				startPrompt(trackerID);
			});

		} else
		{
			console.log("Command not understood.");
		}
	});
}