'use strict';

var WebSocket = require('ws');
var request = require('request');
var prompt = require('prompt');

var args = process.argv.slice(2);// remove command and filename
var email = args[0];
var password = args[1];

if (args[0] == null || args[1] == null )
{
	console.log("args:email password");
	process.exit(1);
}

var appEngineIP = "app.smartsense.co.in:7322";
var appEngineWSIP = "app.smartsense.co.in:7323";

var token = null;
var userID = null;
var self = this;


if (process.env.NODE_ENV === 'dev')
{
	appEngineIP = "localhost:7322";
	appEngineWSIP = "localhost:7323";
}


var userLoginURL = "http://" + appEngineIP + "/user/login";


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
		console.log(body);
		var params = JSON.parse(body);
		
		self.userID = params.id;
		self.token = params.token;
		console.log("Login accepted, token is %s", self.token);
		initializeConnection(userID,token);
	}

});

function handleMessageFromEngine(data)
{
	var params = JSON.parse(data);
	console.log("MESSAGE FROM ENGINE:%s",data);
}

function initializeConnection(userID,token)
{
	var wsURL = "ws://" + appEngineWSIP + "/?userID=U1&token=T1";
	var initURL = wsURL.replace(/U1/, self.userID).replace(/T1/, self.token);
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
				//startPrompt(gatewayID);
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