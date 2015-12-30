'use strict';

var WebSocket = require('ws');
var request = require('request');
var prompt = require('prompt');

var args = process.argv.slice(2);// remove command and filename
var userID = args[0];
var gatewayMac = args[1];
var privateIP = args[2];

if (args[0] == null || args[1] == null || args[2] == null)
{
	console.log("args:userID gatewayMac privateIP");
	process.exit(1);
}

var ip = "hub.smartsense.co.in:80/";
var wsIP = "hub.smartsense.co.in:3000/";

if (process.env.NODE_ENV === 'dev')
{
	ip = "localhost:7320/";
	wsIP = "localhost:3000/";
}

var registerUserURL = "gateway/register/USERID/GATEWAYMAC/PRIVATEIP";
var registerURL = "http://" + ip + registerUserURL.replace(/USERID/, userID).replace(/GATEWAYMAC/, gatewayMac).replace(/PRIVATEIP/, privateIP);

var addDeviceURL = "gateway/registerDevice/GATEWAYID/ZRID/TYPE";
var getSettingsURL = "gateway/settings/GATEWAYID";

var wsURL = "ws://" + wsIP;

// console.log("REST URL:%s\nWS URL:%s", registerURL, wsURL);

var ssid = "Chantik";
var password = "yeahbaby!";

console.log("Hub starting up....");
console.log("Executing POST:%s", registerURL);

// kick off registration
request.post(registerURL, function(error, response, body)
{
	if (!error && response.statusCode == 200)
	{
		var responseParams = JSON.parse(body);
		var gatewayID = responseParams.gatewayID;
		console.log("Registration accepted, gatewayID:%s", gatewayID);
		initializeConnection(gatewayID);
	} else
	{
		console.log("STATUSCODE:%s", response.statusCode);
	}
	;
});

function initializeConnection(gatewayID)
{
	console.log("Opening websocket connection with URL:%s", wsURL);
	var ws = new WebSocket(wsURL);
	var initialized = false;
	ws.on('open', function open()
	{
		console.log("Websocket connection accepted.");

		var init = {
			"command" : "/gateway/initialize",
			"gatewayID" : gatewayID,
			"userID" : userID
		};
		// assert your credentials on init
		ws.send(JSON.stringify(init));

		console.log("Sending initialization command on websocket channel:%s", JSON.stringify(init));

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
			}
		});
		process.on('sendDataToCloud', function(data)
		{
			console.log("Websocket message to cloud:%s", data);
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
			'KEY' : password
		}));
	} else if (command === "/gateway/heartbeat")
	{
		console.log("Acking heartbeat for gatewayID:%s,requestID:%d", gatewayID, requestID);
		process.emit('sendDataToCloud', JSON.stringify({
			'status' : 'OK',
			'requestID' : requestID
		}));
	} else if (command === '/gateway/settings/set')
	{
		ssid = params.ssid;
		password = params.password;
		console.log("Setting gateway details wifi:%s, password:%s", ssid, password);
		process.emit('sendDataToCloud', JSON.stringify({
			'status' : 'OK',
			'requestID' : requestID
		}));
	} else
	{
		console.log("Unknown command:%s", command);
	}
}

function startPrompt(gatewayID)
{
	console.log("your wish is my command....");
	console.log("'registerDevice', 'panicButtonAction','smartPlugAction' supported currently...");
	prompt.start();

	prompt.get([ 'command' ], function(err, result)
	{
		console.log("command:%s", result.command);
		if (result.command === 'registerDevice')
		{
			console.log("Type can be either : PA(panicbutton) or SM(smartplug)")
			prompt.get([ 'type' ], function(err, result)
			{
				var type = result.type;
				prompt.get([ 'zigbeeRadioID' ], function(err, result)
				{
					registerZigbeeDevice(gatewayID, result.zigbeeRadioID, type, function(err, deviceID)
					{
						if (err)
						{
							console.log(err);
						} else
						{
							console.log("Zigbee device successfully registered with deviceID:%s", deviceID)
						}
						startPrompt(gatewayID);
					});

				});

			});
		} else if (result.command === 'panicButtonAction')
		{

			request.get("http://localhost:7320/user/alldevices/" + userID, function(error, response, body)
			{
				console.log("Registered panic buttons....");
				var params = JSON.parse(response.body);
				for (var i = 0; i < params.length; i++)
				{
					var row = params[i];
					if (row.type === 'PA' && gatewayID == row.linkedGatewayID)
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
							// /panicButton/buttonPress/gatewayID/deviceID/timeStamp
							var panicButtonPressURL = "http://" + ip + "panicButton/buttonPress/"+gatewayID+"/"+deviceID+"/2015-07-21T07:50:34+05:30";
							console.log("Executing POST:%s",panicButtonPressURL)
							request2.post(panicButtonPressURL, function(error, response, body)
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
							var ivr = "http://" + ip + "panicButton/ivrSuccess/"+gatewayID+"/"+deviceID+"/+919987792049/2015-07-21T07:50:34+05:30";
							console.log("Executing POST:%s",ivr)
							request2.post(ivr, function(error, response, body)
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
							var ivr = "http://" + ip + "panicButton/ivrFailure/"+gatewayID+"/"+deviceID+"/2015-07-21T07:50:34+05:30";
							console.log("Executing POST:%s",ivr)
							request2.post(ivr, function(error, response, body)
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
							var ivr = "http://" + ip + "panicButton/fallDetected/"+gatewayID+"/"+deviceID+"/2.0/2015-07-21T07:50:34+05:30";
							console.log("Executing POST:%s",ivr)
							request2.post(ivr, function(error, response, body)
							{
								if (error)
									console.log(error);
								else if (response.statusCode == 200)
									console.log("Fall acknowledged!");
								else
									console.log("Fall NOT acknowledged!");
								startPrompt(gatewayID);
							});
						}else if (result.action === 'fallfalsealarm')
						{
							var request2 = require('request');
							console.log("Assuming number of g's is 2.0!");
							var ivr = "http://" + ip + "panicButton/fallFalseAlarm/"+gatewayID+"/"+deviceID+"/2.0/2015-07-21T07:50:34+05:30";
							console.log("Executing POST:%s",ivr)
							request2.post(ivr, function(error, response, body)
							{
								if (error)
									console.log(error);
								else if (response.statusCode == 200)
									console.log("Fall false alarm acknowledged!");
								else
									console.log("Fall false alarm NOT acknowledged!");
								startPrompt(gatewayID);
							});
						}else if (result.action === 'lowbattery')
						{
							var request2 = require('request');
							console.log("Assuming battery level is 20%");
							var ivr = "http://" + ip + "panicButton/lowBattery/"+gatewayID+"/"+deviceID+"/20/2015-07-21T07:50:34+05:30";
							console.log("Executing POST:%s",ivr)
							request2.post(ivr, function(error, response, body)
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

			request.get("http://localhost:7320/user/alldevices/" + userID, function(error, response, body)
			{
				console.log("Registered smart plugs ....");
				var params = JSON.parse(response.body);
				for (var i = 0; i < params.length; i++)
				{
					var row = params[i];
					if (row.type === 'SM' && gatewayID == row.linkedGatewayID)
					{
						console.log("smartPlugID:%s", row.deviceID);
					}
				}
				prompt.get([ 'ID' ], function(err, result)
				{
					var deviceID = result.ID;
					console.log("Allowable actions:on,off");
					prompt.get([ 'action' ], function(err, result)
					{
						if (result.action === "on")
						{
//							var request2 = require('request');
//							// /panicButton/buttonPress/gatewayID/deviceID/timeStamp
//							var panicButtonPressURL = "http://" + ip + "panicButton/buttonPress/"+gatewayID+"/"+deviceID+"/2015-07-21T07:50:34+05:30";
//							console.log("Executing POST:%s",panicButtonPressURL)
//							request2.post(panicButtonPressURL, function(error, response, body)
//							{
//								if (error)
//									console.log(error);
//								else if (response.statusCode == 200)
//									console.log("Panic button press acknowledged!");
//								else
//									console.log("Panic button press NOT acknowledged!");
//								startPrompt(gatewayID);
//							});
						} else if (result.action === "of"){
//							var request2 = require('request');
//							// /panicButton/buttonPress/gatewayID/deviceID/timeStamp
//							var panicButtonPressURL = "http://" + ip + "panicButton/buttonPress/"+gatewayID+"/"+deviceID+"/2015-07-21T07:50:34+05:30";
//							console.log("Executing POST:%s",panicButtonPressURL)
//							request2.post(panicButtonPressURL, function(error, response, body)
//							{
//								if (error)
//									console.log(error);
//								else if (response.statusCode == 200)
//									console.log("Panic button press acknowledged!");
//								else
//									console.log("Panic button press NOT acknowledged!");
//								startPrompt(gatewayID);
//							});
							
						}
					});
				});
			}); 
		} else {
			console.log("Unknown command:%s", result.command);
			startPrompt(gatewayID);
		}
	});

};

var panicButtons = [];
var smartPlugs = [];

function registerZigbeeDevice(gatewayID, zigbeeRadioID, type, callback)
{
	var url = "http://" + ip + addDeviceURL.replace(/GATEWAYID/, gatewayID).replace(/ZRID/, zigbeeRadioID).replace(/TYPE/, type);

	console.log("Executing POST:%s", url);
	request.post(url, function(error, response, body)
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