'use strict';

var request = require('request');
var prompt = require('prompt');

var args = process.argv.slice(2);// remove command and filename
var IMEI = args[0];
var phoneNumber = args[1];
var userID = args[2];

if (args[0] == null || args[1] == null || args[2] == null)
{
	console.log("args:IMEI phoneNumber userID");
	process.exit(1);
}

var trackerEngineIP = "tracker.smartsense.co.in:80/";
if (process.env.NODE_ENV === 'dev')
{
	trackerEngineIP = "localhost:7326/";
}

var initURL = "http://" + trackerEngineIP + "tracker/register";
var registerURL = "http://" + trackerEngineIP + "tracker/register/user";
var loginURL = "http://" + trackerEngineIP + "tracker/login";
var dataURL = "http://" + trackerEngineIP + "tracker/data";

console.log("Tracker registering with cloud....");
console.log("Executing POST:%s", initURL);

// kick off registration
request.post({
	url : initURL,
	form : {
		imei : IMEI
	// phoneNumber : phoneNumber,
	// activated : 'false'
	}
}, function(error, response, body)
{
	if (!error && response.statusCode == 200)
	{
		var responseParams = JSON.parse(body);
		console.log("Initialization accepted, registering this tracker with userID:%s on URL:%s", userID, registerURL);

		request.post({
			url : registerURL,
			form : {
				phoneNumber : phoneNumber,
				imei : IMEI

			},
			headers : {
				userID : userID
			}
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
						form : {
							TID : result.TID
						}
					}, function(error, response, body)
					{
						if (!error && response.statusCode == 200)
						{
							//var responseParams = JSON.parse(response.body);
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
		console.log("ERROR:%s", error);
		console.log("STATUSCODE:%s", response && response.statusCode);
		console.log("BODY:%s", response.body && response.body);
	}
	;
});

function getDate()
{
	return new Date().toISOString().replace(/T/, ' ').replace(/\.\d\d\dZ/, '');
}

function startPrompt(trackerID)
{
	console.log("your wish is my command....");
	console.log("Allowable actions:panic,location");
	prompt.start();

	prompt.get([ 'command' ], function(err, result)
	{
		console.log("command:%s", result.command);
		var command = result.command;
		if (command === 'panic')
		{
			var opts = {
				ALERT : "SOS",
				Ops : "M",
				TID : trackerID,
				DateTime : getDate()
			};
			console.log("Registering panic button press with cloud on URL:%s and options:%s", dataURL, JSON.stringify(opts));
			request.post({
				url : dataURL,
				form : opts
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

			rl.question("Please type in location:LAT,LONG,SPEED,ALTI,isLocationGPSDerived(0 or 1),BLV(battery level ie 345)\n", function(answer)
			{
				rl.close();
				var params = answer.split(",");
				var gpsDerived = "1";// implies LBS
				if (params[4] === "1")
					gpsDerived = "2";// implies GPS

				var opts = {

					
					TID : trackerID,
					LatLng : params[0] +","+params[1],
					SpeedAlti : params[2] + "," + params[3],
					DateTime : getDate(),
					ALERT : "REG",
					Battery : params[5],
					Ops : "A",
					Net : gpsDerived,

					
				};

				console.log("Registering location update with cloud on URL:%s and options:%s", dataURL, JSON.stringify(opts));
				request.post({
					url : dataURL,
					form : opts
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
		} else
		{
			console.log("Command not understood.");
		}
	});
}