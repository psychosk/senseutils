'use strict';

var WebSocket = require('ws');
var request = require('request');
var prompt = require('prompt');

var args = process.argv.slice(2);// remove command and filename
var email = args[0];
var password = args[1];
var gatewayMac = args[2];
var privateIP = args[3];

if (args[0] == null || args[1] == null || args[2] == null || args[3] == null)
{
	console.log("args:email password gatewayMac privateIP");
	process.exit(1);
}

var hubEngineIP = "hub.smartsense.co.in:7320/";
var hubEngineWSIP = "hub.smartsense.co.in:7321/";
var appEngineIP = "app.smartsense.co.in:80/"


if (process.env.NODE_ENV === 'dev')
{
	hubEngineIP = "localhost:7320/";
	hubEngineWSIP = "localhost:7321/";
	appEngineIP = "localhost:7322/";
}

var registerURL = "http://" + hubEngineIP + "gateway/register";
var loginURL = "http://" + hubEngineIP + "gateway/login"
var userLoginURL = "http://" + appEngineIP + "user/login";

var addPanicButtonURL = "http://" + hubEngineIP + "panicButton/register/ZRID"

var wsURL = "ws://" + hubEngineWSIP + "?gatewayID=G1&userID=U1&token=T1";
var ssid = "Chantik";
var wifiPassword = "yeahbaby!";

var token = null;
var userToken = null;
var userID = null;
console.log("Hub starting up....");

var self = this;

console.log("User login....");
console.log("Executing POST:%s", userLoginURL);
request.post({
	url : userLoginURL,
	form : {
		email : email,
		password : password
	}
}, function(error, response, body)
{
	if (!error && response.statusCode == 200)
	{
		var params = JSON.parse(response.body);
		self.userToken = params.token;
		self.userID = params.id;
		console.log("Executing POST:%s", registerURL);
		request.post({
			url : registerURL,
			form : {
				gatewayMac : gatewayMac,
				userID : self.userID,
				privateIP : privateIP
			}
		}, function(error, response, body)
		{
			if (!error && response.statusCode == 200)
			{
				var responseParams = JSON.parse(body);
				var gatewayID = responseParams.gatewayID;
				console.log("Registration accepted, gatewayID:%s, proceeding with login", gatewayID);
				console.log("Executing POST:%s", loginURL);
				request.post({
					url : loginURL,
					form : {
						gatewayID : gatewayID,
						userID : userID
					}
				}, function(error, response, body)
				{
					if (!error && response.statusCode == 200)
					{
						var params = JSON.parse(body);
						self.token = params.token;
						console.log("Login accepted, token is %s", self.token);
						initializeConnection(gatewayID);
					} else
					{
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
	} else
	{
		console.log("ERROR:%s", error);
		console.log("STATUSCODE:%s", response && response.statusCode);
		console.log("BODY:%s", response.body && response.body);
	}
});

function initializeConnection(gatewayID)
{
	var initURL = wsURL.replace(/G1/, gatewayID).replace(/U1/, self.userID).replace(/T1/, self.token);
	console.log("Opening websocket connection with URL:%s", initURL);
	var ws = new WebSocket(initURL);
	var initialized = false;
	ws.on('open', function open()
	{
		console.log("Websocket connection opened.");
		console.log("Waiting for acknowledgement from cloud.");

		ws.once('message', function(data, flags)
		{
			var data = JSON.parse(data);
			if (data.status === 'ACCEPTED')
			{
				console.log("Initialization accepted!")
				ws.on('message', handleMessageFromEngine);
				startPrompt(gatewayID);
			} else
			{
				// keep retrying, HOW TO POINT IT BACK TO MYSELF?
				console.log("Initialization failed!");
				process.exit(1);
			}
		});
		process.on('sendDataToCloud', function(data)
		{
			// console.log("Websocket message to cloud:%s", data);
			ws.send(data);
		});
	});

	ws.on('error', function(err)
	{
		console.log(err);
		throw err;
	});

};

// process.emit('outboundData', JSON.stringify({
// 'command' : '/gateway/settings/get',
// 'gatewayID' : gatewayID
// }));

function handleMessageFromEngine(data, flags)
{
	var params = JSON.parse(data);
	var command = params.command;
	var gatewayID = params.gatewayID;
	var deviceID = params.deviceID;
	var requestID = params.requestID;
	if (command === "/gateway/deleteDevice")
	{
		console.log("Deleting device with deviceID:%s", deviceID);
		// DUMMY DELETE!
		process.emit('sendDataToCloud', JSON.stringify({
			'status' : 'OK',
			'requestID' : requestID
		}));
	} else if (command === "/gateway/settings/get")
	{
		console.log("Getting settings for deviceID:%s", gatewayID);
		// GIVE IT THE DETAILS
		process.emit('sendDataToCloud', JSON.stringify({
			'status' : 'OK',
			'requestID' : requestID,
			'gatewayID' : gatewayID,
			'SSID' : ssid,
			'KEY' : wifiPassword
		}));
	} else if (command === "/gateway/heartbeat")
	{
		console.log("NOT Acking heartbeat for gatewayID:%s,requestID:%d", gatewayID, requestID);
		process.emit('sendDataToCloud', JSON.stringify({
			'status' : 'OK',
			'requestID' : requestID
		}));
	} else if (command === '/gateway/settings/set')
	{
		ssid = params.ssid;
		wifiPassword = params.password;
		console.log("Setting gateway details wifi:%s, password:%s", ssid, password);
		process.emit('sendDataToCloud', JSON.stringify({
			'status' : 'OK',
			'requestID' : requestID
		}));

	} else if (command === '/smartPlug/controlDevice')
	{
		var action = params.action;
		if (action === "0")
			console.log("Switching smartPlugID:%s OFF", deviceID);
		else if (action === "1")
			console.log("Switching smartPlugID:%s ON", deviceID);
		else
			console.log("Unknown action:%s", action);

		process.emit('sendDataToCloud', JSON.stringify({
			'status' : 'OK',
			'requestID' : requestID
		}));
	} else
	{
		console.log("Unknown command:%s", command);
	}

}

function getDate()
{
	return new Date().toISOString().replace(/T/, ' ').replace(/\.\d\d\dZ/, '');
}

function startPrompt(gatewayID)
{
	console.log("your wish is my command....");
	console.log("'registerPanicButton', 'registerSmartPlug','panicButtonAction','smartPlugAction' supported currently...");
	prompt.start();

	prompt.get([ 'command' ], function(err, result)
	{
		console.log("command:%s", result.command);
		if (result.command === 'registerPanicButton')
		{
			prompt.get([ 'zigbeeRadioID' ], function(err, result)
			{
				registerZigbeeDevice(gatewayID, result.zigbeeRadioID, 'PA', function(err, deviceID)
				{
					if (err)
					{
						console.log(err);
					} else
					{
						console.log("Panic button registered with deviceID:%s", deviceID)
					}
					startPrompt(gatewayID);
				});

			});

		} else if (result.command === 'registerSmartPlug')
		{
			prompt.get([ 'zigbeeRadioID' ], function(err, result)
			{
				registerZigbeeDevice(gatewayID, result.zigbeeRadioID, 'SM', function(err, deviceID)
				{
					if (err)
					{
						console.log(err);
					} else
					{
						console.log("Smart plug successfully registered with deviceID:%s", deviceID)
					}
					startPrompt(gatewayID);
				});

			});

		} else if (result.command === 'panicButtonAction')
		{

			var allDevicesURL = "http://" + appEngineIP + "user/alldevices";
			console.log("Hitting %s", allDevicesURL);
			var headers = {
				'token' : self.userToken,
				'userid' : self.userID
			};
			console.log("Params are %s", JSON.stringify(headers));
			request.get({
				url : allDevicesURL,
				headers : headers
			}, function(error, response, body)
			{
				console.log("Registered panic buttons....");
				var params = JSON.parse(response.body);
				for (var i = 0; i < params.length; i++)
				{
					var row = params[i];
					if (row.type === 'panicbutton' && gatewayID == row.linkedGatewayID)
					{
						console.log("panicButtonID:%s", row.deviceID);
					}
				}
				prompt.get([ 'ID' ], function(err, result)
				{
					var deviceID = result.ID;
					console.log("Allowable actions:buttonpress,ivrsuccess,ivrfailure,falldetected,fallfalsealarm,lowbattery");
					prompt.get([ 'action' ], function(err, result)
					{
						if (result.action === "buttonpress")
						{
							var request2 = require('request');
							// 2016-01-01T01:33:26.000Z
							var timeStamp = getDate();
							console.log("Using timestamp %s", timeStamp);
							var panicButtonPressURL = "http://" + hubEngineIP + "panicButton/buttonPress/" + deviceID + "/" + timeStamp;
							console.log("Executing POST:%s", panicButtonPressURL);

							request2.post({
								url : panicButtonPressURL,
								headers : {
									'token' : self.token,
									'gatewayid' : gatewayID
								}
							}, function(error, response, body)
							{
								if (error)
									console.log(error);
								else if (response.statusCode == 200)
									console.log("Panic button press acknowledged!");
								else
									console.log("Panic button press NOT acknowledged!");
								startPrompt(gatewayID);
							});
						} else if (result.action === 'ivrsuccess')
						{
							console.log("Assuming phone number +919987792049");
							var request2 = require('request');
							// /panicButton/buttonPress/gatewayID/deviceID/timeStamp
							var ivr = "http://" + hubEngineIP + "panicButton/ivrSuccess/" + deviceID + "/+919987792049/" + getDate();
							console.log("Executing POST:%s", ivr)
							request2.post({
								url : ivr,
								headers : {
									'token' : self.token,
									'gatewayid' : gatewayID
								}
							}, function(error, response, body)
							{
								if (error)
									console.log(error);
								else if (response.statusCode == 200)
									console.log("IVR success acknowledged!");
								else
									console.log("IVR success NOT acknowledged!");
								startPrompt(gatewayID);
							});
						} else if (result.action === 'ivrfailure')
						{
							var request2 = require('request');
							var ivr = "http://" + hubEngineIP + "panicButton/ivrFailure/" + deviceID + "/" + getDate();
							console.log("Executing POST:%s", ivr)
							request2.post({
								url : ivr,
								headers : {
									'token' : self.token,
									'gatewayid' : gatewayID
								}
							}, function(error, response, body)
							{
								if (error)
									console.log(error);
								else if (response.statusCode == 200)
									console.log("IVR failure acknowledged!");
								else
									console.log("IVR failure NOT acknowledged!");
								startPrompt(gatewayID);
							});
						} else if (result.action === 'falldetected')
						{
							var request2 = require('request');
							console.log("Assuming number of g's is 2.0!");
							var ivr = "http://" + hubEngineIP + "panicButton/fallDetected/" + deviceID + "/2.0/" + getDate();
							console.log("Executing POST:%s", ivr)
							request2.post({
								url : ivr,
								headers : {
									'token' : self.token,
									'gatewayid' : gatewayID
								}
							}, function(error, response, body)
							{
								if (error)
									console.log(error);
								else if (response.statusCode == 200)
									console.log("Fall acknowledged!");
								else
									console.log("Fall NOT acknowledged!");
								startPrompt(gatewayID);
							});
						} else if (result.action === 'fallfalsealarm')
						{
							var request2 = require('request');
							console.log("Assuming number of g's is 2.0!");
							var ivr = "http://" + hubEngineIP + "panicButton/fallFalseAlarm/" + deviceID + "/2.0/" + getDate();
							console.log("Executing POST:%s", ivr)
							request2.post({
								url : ivr,
								headers : {
									'token' : self.token,
									'gatewayid' : gatewayID
								}
							}, function(error, response, body)
							{
								if (error)
									console.log(error);
								else if (response.statusCode == 200)
									console.log("Fall false alarm acknowledged!");
								else
									console.log("Fall false alarm NOT acknowledged!");
								startPrompt(gatewayID);
							});
						} else if (result.action === 'lowbattery')
						{
							var request2 = require('request');
							console.log("Assuming battery level is 20%");
							var ivr = "http://" + hubEngineIP + "panicButton/lowBattery/" + deviceID + "/20/" + getDate();
							console.log("Executing POST:%s", ivr)
							request2.post({
								url : ivr,
								headers : {
									'token' : self.token,
									'gatewayid' : gatewayID
								}
							}, function(error, response, body)
							{
								if (error)
									console.log(error);
								else if (response.statusCode == 200)
									console.log("Low battery acknowledged!");
								else
									console.log("Low battery NOT acknowledged!");
								startPrompt(gatewayID);
							});
						}
					});
				});
			});
		} else if (result.command === 'smartPlugAction')
		{
			var allDevicesURL = "http://" + appEngineIP + "user/alldevices";
			request.get({
				url : allDevicesURL,
				headers : {
					'token' : self.userToken,
					'userid' : self.userID
				}
			}, function(error, response, body)
			{
				console.log("Registered smart plugs ....");
				var params = JSON.parse(response.body);
				for (var i = 0; i < params.length; i++)
				{
					var row = params[i];
					if (row.type === 'smartplug' && gatewayID == row.linkedGatewayID)
					{
						console.log("smartPlugID:%s", row.deviceID);
					}
				}
				prompt.get([ 'ID' ], function(err, result)
				{
					var deviceID = result.ID;
					console.log("Allowable actions:1 (switch on),0 (switch off)");
					prompt.get([ 'action' ], function(err, result)
					{
						if (result.action === "1" || result.action === "0")
						{
							var request2 = require('request');
							// /panicButton/buttonPress/gatewayID/deviceID/timeStamp
							var url = "http://" + hubEngineIP + "smartPlug/manualAction/" +gatewayID + "/" + deviceID + "/" + result.action + "/" + getDate();
							console.log("Executing POST:%s", url)
							request2.post({
								url : url,
								headers : {
									'token' : self.token,
									'gatewayid' : gatewayID
								}
							}, function(error2, response2, body2)
							{
								if (error2)
								{
									console.log(error2);
								} else if (response2.statusCode == 200)
									console.log("Smart plug manual action acknowledged!");
								else
									console.log("Smart plug manual action NOT acknowledged:%s", response2.statusCode);
								startPrompt(gatewayID);
							});
						}
					});
				});
			});
		} else
		{
			console.log("Unknown command:%s", result.command);
			startPrompt(gatewayID);
		}
	});

};

var panicButtons = [];
var smartPlugs = [];

function registerZigbeeDevice(gatewayID, zigbeeRadioID, type, callback)
{
	var url = "http://" + hubEngineIP;
	if (type === 'SM')
	{
		url += "smartPlug/register/" + zigbeeRadioID;
	} else
	{
		url += "panicButton/register/" + zigbeeRadioID;
	}

	console.log("Executing POST:%s and token is %s", url, self.token);

	
	request.post({
		url : url,
		headers : {
			'token' : self.token,
			'gatewayid' : gatewayID
		}

	}, function(error, response, body)
	{
		if (!error && response.statusCode == 200)
		{
			var responseParams = JSON.parse(body);
			var deviceID = responseParams.deviceID;
			if (deviceID != null)
			{
				callback(null, deviceID);
				if (type === 'SM')
					smartPlugs.push(deviceID);
				else if (type === 'PA')
					panicButtons.push(deviceID);
			} else
			{
				callback("Could not obtain deviceID");
			}
		} else
		{
			callback("STATUSCODE:" + response.statusCode);
		}
		;
	});
};