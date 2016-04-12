/**
 * Module dependencies.
 */
var express = require('express'), routes = require('./routes'), user = require('./routes/user'), http = require('http'), path = require('path');
var forms = require('forms');
var request = require('request');
var util = require('util');
var logger = require('express-logger');
// var bodyParser = require('body-parser');
var app = express();

// all environments
app.set('port', process.env.PORT || 4000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

var logdir = "/var/tmp/mws.log"

app.use(logger({
	path : logdir
}));

var webserverIP = "http://hub.smartsense.co.in:4000/";
var hubEngineIP = "http://hub.smartsense.co.in:7320/";
var trackerEngineIP = "http://tracker.smartsense.co.in:7326/";
var appEngineIP = "http://app.smartsense.co.in:7322/";
//var appWSEngineIP = "ws://app.smartsense.co.in:7323/"
var appWSEngineIP = "ws://app.smartsense.co.in:7333/"; //secure web socket;

var sessionData = {};

// var userToken = null;
// var userID = null;
var self = this;

if (process.env.NODE_ENV === 'dev' || process.env.USER === 'sid')
{
	console.log("Using dev environment!");
	webserverIP = "http://localhost:4000/";
	hubEngineIP = "http://localhost:7320/";
	trackerEngineIP = "http://localhost:7326/";
	appEngineIP = "http://localhost:7322/";
	//appWSEngineIP = "ws://localhost:7323/"
	appWSEngineIP = "ws://localhost:7333/"
	app.use(express.errorHandler());
}

app.get('/', function(req, res)
{

	var data = "";

	var Form = require('form-builder').Form;

	var myForm = Form.create({
		action : webserverIP + "user/registerUser",
		method : 'post'
	}, {
		user : {
			email : 'my@email.com',
			password : '...'
		}
	});
	// opens the form
	data += myForm.open();

	data += "Email:";

	// add the first field and renders it
	data += myForm.email().attr('name', 'emailID').render();
	data += "<br>Password:";

	// add the last name field and renders it
	data += myForm.password().attr('name', 'password').render();
	data += "<br>";

	data += myForm.submit().attr('value', 'create account').attr('name', 'submitButton').render();

	data += myForm.submit().attr('value', 'login').attr('name', 'submitButton').render();

	// closes form
	data += myForm.end(); // returns </form>

	res.send(data);
});

app.post('/user/registerUser', function(req, res)
{
	var emailID = req.body.emailID;
	var password = req.body.password;

	var action = req.body.submitButton;
	var data = "";

	if (action === 'create account')
	{
		var registerURL = appEngineIP + "user/create";
		console.log("Hitting %s", registerURL);
		request.post({
			url : registerURL,
			form : {
				email : emailID,
				password : password
			}
		}, function(error, response, body)
		{

			if (!error && response.statusCode == 200)
			{
				var responseParams = JSON.parse(body);
				sessionData[responseParams.userID] = {};
				console.log("Registration accepted, userID:%s", responseParams.userID);
				data += util.format("Registration accepted userID:%s. Go back to login now.", responseParams.userID);
			} else
			{
				console.log("Registration failed!");
				data += util.format("Registration failed!");
				data += util.format("ERROR:%s", error);
				data += util.format("STATUSCODE:%s", response && response.statusCode);
				data += util.format("BODY:%s", response.body && response.body);
			}

			res.send(data);
		});

	} else if (action === 'login')
	{
		var loginURL = appEngineIP + "user/login";
		console.log("Hitting %s", loginURL);
		request.post({
			url : loginURL,
			form : {
				email : emailID,
				password : password
			}
		}, function(error, response, body)
		{
			if (!error && response.statusCode == 200)
			{
				var responseParams = JSON.parse(body);
				self.userToken = responseParams.token;
				self.userID = responseParams.id;
				console.log("Login accepted, token is %s and userID is %s", self.userToken, self.userID);
				sessionData[responseParams.id] = {
					token : responseParams.token
				};

				// console.log("Session data now looks like %s",
				// JSON.stringify(sessionData));

				var getDevicesUrl = appEngineIP + "user/alldevices";
				var request2 = require('request');
				request2.get({
					url : getDevicesUrl,
					headers : {
						token : self.userToken,
						userid : self.userID
					}
				}, function(error, response, body)
				{
					if (!error && response.statusCode == 200)
					{

						var gateways = [];
						var cameras = [];
						var trackers = [];
						var panicbuttons = [];
						var smartplugs = [];

						var params = JSON.parse(response.body);
						// console.log("GOT:%s", JSON.stringify(params));

						for (var i = 0; i < params.length; i++)
						{
							var row = params[i];
							// console.log("Processing %s",
							// JSON.stringify(row));
							if (row.type === 'gateway')
							{
								gateways.push({
									deviceID : row.deviceID,
									gatewayName : row.name
								});
							} else if (row.type === 'tracker')
							{
								trackers.push({
									deviceID : row.deviceID,
									trackerName : row.name
								});
							} else if (row.type === 'camera')
							{
								cameras.push({
									deviceID : row.deviceID,
									cameraName : row.name
								});
							} else if (row.type === 'panicbutton')
							{
								panicbuttons.push({
									deviceID : row.deviceID,
									gatewayID : row.linkedGatewayID,
									deviceName : row.name
								});
							} else if (row.type === 'smartplug')
							{
								smartplugs.push({
									deviceID : row.deviceID,
									gatewayID : row.linkedGatewayID,
									deviceName : row.name
								});
							} else
							{
								console.log("Unknown type:%s", row.type);
							}
						}

						data += "<html><head>";

						data += "" + "<script>" + "var messages = []; function updateMessage(message) {"
								+ " messages.push(message); document.getElementById('messages').innerHTML = messages.toString() ;" + "}" + " var ws = new WebSocket('" + appWSEngineIP + "?userID="
								+ self.userID + "&token=" + self.userToken + "'); " + " ws.onmessage = function (event) { " + " updateMessage(event.data); " + " }; " + " </script></head><body>";

						data += "<strong>Messages (available only on this screen): </strong><div id='messages'></div><br>";

						data += "<b>Your linked gateways (note that the gateway must be connected in order for these commands to work):</b><br>";

						for (var i = 0; i < gateways.length; ++i)
						{
							data += "GatewayName:" + gateways[i].gatewayName + ",GatewayID:" + gateways[i].deviceID + "<a href=\"" + webserverIP + "configure/gateway/" + gateways[i].deviceID
									+ "\">Configure</a>";
							data += "<a href=\"" + webserverIP + "permitjoin/gateway/" + gateways[i].deviceID + "\"> Permit join </a>";
							data += "<a href=\"" + webserverIP + "delete/gateway/" + gateways[i].deviceID + "\"> Unlink (unlinks all paired smartplugs/panicbuttons as well) </a>";
							data += "<br>";

						}

						data += "<b>Your linked panic buttons:</b><br>";

						for (var i = 0; i < panicbuttons.length; ++i)
						{
							var deviceID = panicbuttons[i].deviceID;
							var gatewayID = panicbuttons[i].gatewayID;
							var deviceName = panicbuttons[i].deviceName;
							data += "DeviceName: " + deviceName + ",DeviceID:" + deviceID + "<a href=\"" + webserverIP + "configure/panicbutton/" + gatewayID + "/" + deviceID + "\">Configure</a>  "
							data += "<a href=\"" + webserverIP + "info/panicbutton/" + gatewayID + "/" + deviceID + "\"> Info</a>";
							data += "<a href=\"" + webserverIP + "delete/device/" + gatewayID + "/" + deviceID + "\"> Unlink </a><br>";
						}

						data += "<b>Your linked smart plugs:</b><br>";

						for (var i = 0; i < smartplugs.length; ++i)
						{
							var deviceID = smartplugs[i].deviceID;
							var gatewayID = smartplugs[i].gatewayID;
							var deviceName = smartplugs[i].deviceName;
							data += "DeviceName: " + deviceName + ",DeviceID:" + deviceID + "<a href=\"" + webserverIP + "configure/smartplug/" + gatewayID + "/" + deviceID + "\">Configure</a>  "
							data += "<a href=\"" + webserverIP + "info/smartplug/" + gatewayID + "/" + deviceID + "\">Info</a>  ";
							data += "<a href=\"" + webserverIP + "action/smartplug/" + gatewayID + "/" + deviceID + "/1\"> Switch on</a>  ";
							data += "<a href=\"" + webserverIP + "action/smartplug/" + gatewayID + "/" + deviceID + "/0\"> Switch off</a>"
							data += "<a href=\"" + webserverIP + "delete/device/" + gatewayID + "/" + deviceID + "\"> Unlink</a><br>";

						}

						data += "<b>Your linked cameras</b>:<br>";

						for (var i = 0; i < cameras.length; ++i)
						{
							data += "Name :" + cameras[i].cameraName + ", CameraID:" + cameras[i].deviceID + "<a href=\"" + webserverIP + "configure/camera/" + cameras[i].cameraID
									+ "\">Configure</a><br>"
						}

						data += "<b>Your linked trackers:</b><br>";

						for (var i = 0; i < trackers.length; ++i)
						{
							data += "Name :" + trackers[i].trackerName + ",TrackerID:" + trackers[i].deviceID + "<a href=\"" + webserverIP + "configure/tracker/" + trackers[i].deviceID
									+ "\">Configure</a>";
							data += "  <a href=\"" + webserverIP + "location/tracker/" + trackers[i].deviceID + "\">Location data</a>";
							data += "  <a href=\"" + webserverIP + "event/tracker/" + trackers[i].deviceID + "\">Event data</a>";
							data += "  <a href=\"" + webserverIP + "livetracking/tracker/" + trackers[i].deviceID + "/1\">Start live tracking</a>";
							data += "  <a href=\"" + webserverIP + "livetracking/tracker/" + trackers[i].deviceID + "/0\">Stop live tracking</a>";
							data += "  <a href=\"" + webserverIP + "stopsos/tracker/" + trackers[i].deviceID + "\">Stop SOS mode</a>";
							data += "<br>";

						}
					} else
					{
						console.log("Get failed!");
						data += util.format("Login failed!");
						data += util.format("ERROR:%s", error);
						data += util.format("STATUSCODE:%s", response && response.statusCode);
						data += util.format("BODY:%s", body);
					}
					data += "</body></html>";

					res.send(data);

				});

			} else
			{
				console.log("Login failed!");
				data += util.format("Login failed!");
				data += util.format("ERROR:%s", error);
				data += util.format("STATUSCODE:%s", response && response.statusCode);
				data += util.format("BODY:%s", body);

			}
		});

	}
});

/**
 * Change settings of gateway
 */
app.get('/delete/gateway/:gatewayID', function(req, res)
{
	var gatewayID = req.params.gatewayID;

	var settingsURL = appEngineIP + "gateway/unlink";
	request.post({
		url : settingsURL,
		json : {
			gatewayID : gatewayID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response.statusCode == 200)
		{
			res.send("Unlink completed!");
		} else
		{
			res.send(util.format("Status code:%s, error:%s", response.statusCode, body));
		}
	});

});

/**
 * Change settings of gateway
 */
app.get('/permitjoin/gateway/:gatewayID', function(req, res)
{
	var gatewayID = req.params.gatewayID;

	var settingsURL = appEngineIP + "gateway/permitjoin";
	request.post({
		url : settingsURL,
		form : {
			gatewayID : gatewayID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response.statusCode == 200)
		{
			res.send("Permit join action complete, quick you have 60 seconds!");
		} else
		{
			res.send(util.format("Status code:%s, error:%s", response.statusCode, body));
		}
	});

});

/**
 * Change settings of gateway
 */
app.post('/configure/gateway/modifysettings/:gatewayID', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var ssid = req.body.ssid;
	var password = req.body.password;
	var name = req.body.name;

	console.log("Setting gateway to %s,%s,%s", ssid, password, name);
	var settingsURL = appEngineIP + "gateway/settings/" + gatewayID;
	request.post({
		url : settingsURL,
		form : {
			ssid : ssid,
			password : password,
			name : name
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		res.json(body);
	});

});

/**
 * get the settings from the server
 */
app.get('/configure/gateway/:gatewayID', function(req, res)
{

	// gateway/settings/:gatewayID

	var gatewayID = req.params.gatewayID;

	var settingsURL = appEngineIP + "gateway/settings?gatewayID=" + gatewayID;
	console.log("HITTING:%s", settingsURL);
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		var data = "";
		if (response.statusCode == 200)
		{

			var params = JSON.parse(body);
			console.log(JSON.stringify(params));

			var data = "NAME:" + params.name + ",WIFI SSID:" + params.SSID + ",WIFI PASS:" + params.KEY + "<br>";

			var Form = require('form-builder').Form;

			var myForm = Form.create({
				action : webserverIP + "configure/gateway/modifysettings/" + gatewayID,
				method : 'post'
			});

			// opens the form
			data += myForm.open(); // will return: <form action="/signup"
			// class="myform-class">

			data += "Name:";
			data += myForm.text().attr('name', 'name').render();

			data += "<br>SSID:";

			// add the first field and renders it
			data += myForm.text().attr('name', 'ssid').render();
			data += "<br>WIFI Password:";

			// add the last name field and renders it
			data += myForm.text().attr('name', 'password').render();

			data += "<br>";

			data += myForm.submit().attr('value', 'change').render();

		} else
		{
			data += "Error:" + JSON.parse(response.body).error;
		}
		res.send(data);
	});

});

/**
 * get the info from the server
 */
app.get('/info/panicbutton/:gatewayID/:deviceID', function(req, res)
{

	// gateway/settings/:gatewayID

	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;
	var settingsURL = appEngineIP + "panicbutton/history?gatewayID=" + gatewayID + "&deviceID=" + deviceID;
	console.log("Going to %s", settingsURL);
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		// console.log(body);
		// console.log("Got response!");
		var data = "<table><tr><td><b>Event</b></td><td><b>Timestamp</b></td><td><b>Phone number</b></td></tr>";
		if (response.statusCode == 200)
		{
			var params = JSON.parse(response.body);
			for (var i = 0; i < params.length; i++)
			{
				var row = params[i];
				// console.log("Processing row %s", JSON.stringify(row));

				data += "<tr>";
				var event = "";
				if (params[i].event === 'PA')
					event = "Panic button press";
				else if (params[i].event === 'SU')
					event = "IVR success";
				else if (params[i].event === 'FA')
					event = "IVR failure";
				else if (params[i].event === 'FL')
					event = "Fall";
				else if (params[i].event === 'FS')
					event = "Fall false alarm";
				data += "<td>" + event + "</td>";
				data += "<td>" + params[i].timeStamp + "</td>";
				data += "<td>" + params[i].phoneNumber + "</td>";
				data += "</tr>"
			}
		}
		data += "</table>"
		res.send(data);
	});
});

app.post('/configure/smartplug/settings/:gatewayID/:deviceID', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;

	var name = req.body.name;

	console.log("Setting smart plug configuration details to %s", JSON.stringify(req.body));
	var settingsURL = appEngineIP + "smartPlug/settings/" + gatewayID + "/" + deviceID;
	request.post({
		url : settingsURL,
		form : {
			name : name,
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response.statusCode == 200)
		{
			res.send("Configuration set successfully, now go back and refresh!");
		} else
		{
			res.send("Error setting configuration:%s", response.body);
		}
	});
});

app.get('/delete/device/:gatewayID/:deviceID', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;

	// console.log("Delete device BODY %s", JSON.stringify(req.body));
	var settingsURL = appEngineIP + "gateway/unlinkDevice";
	request.post({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		},
		json : {
			gatewayID : gatewayID,
			deviceID : deviceID
		}

	}, function(error, response, body)
	{
		if (response.statusCode == 200)
		{
			res.send("Device deleted successfully!");
		} else
		{
			res.send("Error deleting device:%s", response.body);
		}
	});
});

app.post('/configure/panicbutton/settings/:gatewayID/:deviceID', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;

	var emergencyContact1 = req.body.emergencyContact1;
	var emergencyContact2 = req.body.emergencyContact2;
	var emergencyContact3 = req.body.emergencyContact3;
	var emergencyContact4 = req.body.emergencyContact4;
	var emergencyContact5 = req.body.emergencyContact5;
	var adminNumber = req.body.adminNumber;
	var callTimeout = req.body.callTimeout;
	var name = req.body.name;

	console.log("Setting panic button configuration details to %s", JSON.stringify(req.body));
	var settingsURL = appEngineIP + "panicButton/settings/" + gatewayID + "/" + deviceID;
	request.post({
		url : settingsURL,
		form : {
			emergencyContact1 : emergencyContact1,
			emergencyContact2 : emergencyContact2,
			emergencyContact3 : emergencyContact3,
			emergencyContact4 : emergencyContact4,
			emergencyContact5 : emergencyContact5,
			adminNumber : adminNumber,
			callTimeout : callTimeout,
			name : name,
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response.statusCode == 200)
		{
			res.send("Configuration set successfully!");
		} else
		{
			res.send("Error setting configuration:%s", response.body);
		}
	});
});

/**
 * get the settings from the server
 */
app.get('/configure/panicbutton/:gatewayID/:deviceID', function(req, res)
{

	// gateway/settings/:gatewayID

	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;
	var settingsURL = appEngineIP + "panicbutton/settings?gatewayID=" + gatewayID + "&deviceID=" + deviceID;
	// console.log("Going to %s",settingsURL);
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		var data = "";
		if (response.statusCode == 200)
		{

			var params = JSON.parse(body);
			if (params.length == 0)
			{
				data += "No configuration yet<br>";
			} else
			{
				data += JSON.stringify(params);
			}

			var Form = require('form-builder').Form;

			var myForm = Form.create({
				action : webserverIP + "configure/panicbutton/settings/" + gatewayID + "/" + deviceID,
				method : 'post'
			});

			// opens the form
			data += myForm.open();
			data += "Name:";
			data += myForm.text().attr('name', 'name').render() + "<br>";
			data += "Emergency contact 1:";
			data += myForm.text().attr('name', 'emergencyContact1').render() + "<br>";
			data += "Emergency contact 2:";
			data += myForm.text().attr('name', 'emergencyContact2').render() + "<br>";
			data += "Emergency contact 3:";
			data += myForm.text().attr('name', 'emergencyContact3').render() + "<br>";
			data += "Emergency contact 4:";
			data += myForm.text().attr('name', 'emergencyContact4').render() + "<br>";
			data += "Emergency contact 5:";
			data += myForm.text().attr('name', 'emergencyContact5').render() + "<br>";
			data += "Admin number :";
			data += myForm.text().attr('name', 'adminNumber').render() + "<br>";
			data += "Call timeout:";
			data += myForm.text().attr('name', 'callTimeout').render() + "<br>";

			data += myForm.submit().attr('value', 'change').render();

		} else
		{
			data += body.error;
			// data += "Error:"+JSON.parse(body).error;
		}
		res.send(data);
	});

});

function getDate()
{
	return new Date().toISOString().replace(/T/, '%20').replace(/\.\d\d\dZ/, '');
}

/**
 * Change settings of gateway
 */
app.get('/configure/smartplug/:gatewayID/:deviceID', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;

	var settingsURL = appEngineIP + "smartplug/settings?gatewayID=" + gatewayID + "&deviceID=" + deviceID;
	console.log("Going to %s", settingsURL);
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		var data = "";
		if (response.statusCode == 200)
		{

			var params = JSON.parse(body);
			if (params.length == 0)
			{
				data += "No configuration yet<br>";
			} else
			{
				data += JSON.stringify(params);
			}

			var Form = require('form-builder').Form;

			var myForm = Form.create({
				action : webserverIP + "configure/smartplug/settings/" + gatewayID + "/" + deviceID,
				method : 'post'
			});

			// opens the form
			data += myForm.open();
			data += "Name:";
			data += myForm.text().attr('name', 'name').render() + "<br>";

			data += myForm.submit().attr('value', 'change').render();

		} else
		{
			data += body.error;
		}
		res.send(data);
	});
});

app.get('/action/smartplug/:gatewayID/:deviceID/:action', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;
	var action = req.params.action;

	var url = appEngineIP + "smartPlug/controlDevice/" + gatewayID + "/" + deviceID + "/" + action + "/" + getDate();
	console.log("Going to %s", url);
	request.post({
		url : url,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (error)
		{
			res.status(400).send("Smart plug action error:" + error);
		} else if (response.statusCode != 200)
		{
			res.send(util.format("Response status code : %s, body : %s", response.statusCode, body));
		} else
		{
			res.send("Smart plug action accepted!");
		}
	});

});

/**
 * get the info from the server
 */
app.get('/info/smartplug/:gatewayID/:deviceID', function(req, res)
{

	// gateway/settings/:gatewayID

	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;
	var settingsURL = appEngineIP + "smartPlug/history?gatewayID=" + gatewayID + "&deviceID=" + deviceID;
	console.log("Going to %s", settingsURL);
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		// console.log(body);
		// console.log("Got response!");
		var data = "<table><tr><td><b>Event</b></td><td><b>Timestamp</b></td></tr>";
		if (response.statusCode == 200)
		{
			var params = JSON.parse(response.body);
			for (var i = 0; i < params.length; i++)
			{
				var row = params[i];
				data += "<tr>";
				var event = "";
				if (params[i].event === '0')
					event = "Swithched off manually";
				else if (params[i].event === '1')
					event = "Switched on manually";
				else if (params[i].event === '2')
					event = "Switched off remotely";
				else if (params[i].event === '3')
					event = "Switched on remotely";
				else
					event = "Unknown event!";
				data += "<td>" + event + "</td>";
				data += "<td>" + params[i].timeStamp + "</td>";
				data += "</tr>"
			}
		}
		data += "</table>"
		res.send(data);
	});
});

app.post('/configure/tracker/modifysettings/:userTrackerPairID', function(req, res)
{
	var userTrackerPairID = req.params.userTrackerPairID;

	var emergencyContact1 = req.body.emergencyContact1;
	var emergencyContact2 = req.body.emergencyContact2;
	var emergencyContact3 = req.body.emergencyContact3;
	var emergencyContact4 = req.body.emergencyContact4;
	var emergencyContact5 = req.body.emergencyContact5;
	var adminNumber = req.body.adminNumber;
	var callTimeout = req.body.callTimeout;
	var heartbeat = req.body.heartbeat;
	var callInEnabled = req.body.callInEnabled;
	var name = req.body.name;

	console.log("Setting tracker configuration details to %s", JSON.stringify(req.body));
	var settingsURL = appEngineIP + "tracker/settings";
	request.post({
		url : settingsURL,
		json : {
			emergencyContact1 : emergencyContact1,
			emergencyContact2 : emergencyContact2,
			emergencyContact3 : emergencyContact3,
			emergencyContact4 : emergencyContact4,
			emergencyContact5 : emergencyContact5,
			adminNumber : adminNumber,
			callTimeout : callTimeout,
			heartbeat : heartbeat,
			callInEnabled : callInEnabled,
			tid : userTrackerPairID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (error == null && response.statusCode == 200)
		{
			res.send("Configuration set successfully!");
		} else
		{
			res.send("Error setting configuration:" + error);
		}
	});
});

app.get('/configure/tracker/:userTrackerPairID', function(req, res)
{
	var userTrackerPairID = req.params.userTrackerPairID;
	var settingsURL = appEngineIP + "tracker/settings?userTrackerPairID=" + userTrackerPairID;
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		var data = "";
		if (response.statusCode == 200)
		{
			var responseParams = JSON.parse(response.body);

			var emergencyContact1 = responseParams.emergencyContact1;
			var emergencyContact2 = responseParams.emergencyContact2;
			var emergencyContact3 = responseParams.emergencyContact3;
			var emergencyContact4 = responseParams.emergencyContact4;
			var emergencyContact5 = responseParams.emergencyContact5;
			var adminNumber = responseParams.adminNumber;
			var callTimeout = responseParams.callTimeout;
			var heartbeat = responseParams.heartbeat;

			var data = "Existing settings...<br>"
			if (emergencyContact1 == null)
			{
				data += "No existing settings...";
			} else
			{
				data += "Emergency contact 1:" + emergencyContact1 + "<br>emergency contact 2:" + emergencyContact2 + "<br>emergency contact 3:" + emergencyContact3 + "<br>emergency contact 4:"
						+ emergencyContact4 + "<br>emergencyContact 5:" + emergencyContact5 + "<br>adminNumber:" + adminNumber + "<br>callTimeout:" + callTimeout + "<br>heartbeat:" + heartbeat
						+ "<br>"
			}
			var Form = require('form-builder').Form;

			var myForm = Form.create({
				action : webserverIP + "configure/tracker/modifysettings/" + userTrackerPairID,
				method : 'post'
			});

			// opens the form
			data += myForm.open(); // will return: <form action="/signup"
			// class="myform-class">

			data += "Alter settings...<br>";

			data += "Emergency contact 1:"
			data += myForm.text().attr('name', 'emergencyContact1').render() + "<br>";
			data += "Emergency contact 2:"
			data += myForm.text().attr('name', 'emergencyContact2').render() + "<br>";
			data += "Emergency contact 3:"
			data += myForm.text().attr('name', 'emergencyContact3').render() + "<br>";
			data += "Emergency contact 4:"
			data += myForm.text().attr('name', 'emergencyContact4').render() + "<br>";
			data += "Emergency contact 5:"
			data += myForm.text().attr('name', 'emergencyContact5').render() + "<br>";
			data += "Admin number:"
			data += myForm.text().attr('name', 'adminNumber').render() + "<br>";
			data += "Call timeout:"
			data += myForm.text().attr('name', 'callTimeout').render() + "<br>";
			data += "Heartbeat:"
			data += myForm.text().attr('name', 'heartbeat').render() + "<br>";
			data += "Call in enabled:TRUE"
			data += myForm.radio().attr({
				name : 'callInEnabled',
				value : '1'
			}).setDefault().render();
			data += " FALSE" + myForm.radio().attr({
				name : 'callInEnabled',
				value : '0'
			}).render();

			data += "<br>";

			data += myForm.submit().attr('value', 'change').render();

		} else
		{
			data += "Error:" + body;
		}
		res.send(data);
	});
});

app.get('/livetracking/tracker/:userTrackerPairID/:action', function(req, res)
{
	var url = appEngineIP + "tracker/liveTracking";
	console.log("Going to %s", url);
	request.post({
		url : url,
		form : {
			userTrackerPairID : req.params.userTrackerPairID,
			action : req.params.action
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (error)
		{
			res.status(400).send("Tracker live tracking error:" + error);
		} else if (response.statusCode != 200)
		{
			res.send(util.format("Response status code : %s, body : %s", response.statusCode, body));
		} else
		{
			res.send("Tracker action accepted!");
		}
	});
});

app.get('/stopsos/tracker/:userTrackerPairID', function(req, res)
{
	var url = appEngineIP + "tracker/stopSOS";
	console.log("Going to %s", url);
	request.post({
		url : url,
		form : {
			userTrackerPairID : req.params.userTrackerPairID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (error)
		{
			res.status(400).send("Tracker stop SOS error:" + error);
		} else if (response.statusCode != 200)
		{
			res.send(util.format("Response status code : %s, body : %s", response.statusCode, body));
		} else
		{
			res.send("Tracker stop SOS accepted!");
		}
	});
});

app.get('/event/tracker/:userTrackerPairID', function(req, res)
{
	var userTrackerPairID = req.params.userTrackerPairID;
	var settingsURL = appEngineIP + "tracker/events?userTrackerPairID=" + userTrackerPairID;
	var request = require('request');
	var data = "";
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		console.log("Response status code is :%s", response.statusCode);
		if (error == null && response.statusCode == 200)
		{
			console.log("Processing event data!");
			var eventData = JSON.parse(response.body);

			data += "<b>Event Data:</b><br><table><tr><td><b>Event</b></td><td><b>Timestamp</b></td><td><b>Phone number</b></td></tr>";

			for (var i = 0; i < eventData.length; i++)
			{
				var row = eventData[i];
				//console.log("Processing row %s", JSON.stringify(row));

				data += "<tr>";
				var event = "";
				if (row.event === 'PA')
					event = "Panic button press";
				else if (row.event === 'SU')
					event = "IVR success";
				else if (row.event === 'FA')
					event = "IVR failure";
				else
					event = "Unknown event";
				data += "<td>" + event + "</td>";
				data += "<td>" + row.timeStamp + "</td>";
				data += "<td>" + row.phoneNumber + "</td>";
				data += "</tr>"
			}
			data += "</table><br>";

		} else
		{
			console.log(error);
			console.log(response != undefined ? response.body : "body undefined!");
		}
		res.send(data);
	});
});

/**
 * get the info from the server
 */
app
		.get(
				'/location/tracker/:userTrackerPairID',
				function(req, res)
				{
					var userTrackerPairID = req.params.userTrackerPairID;
					var settingsURL = appEngineIP + "tracker/location?userTrackerPairID=" + userTrackerPairID;
					//console.log("Going to %s with %s and %s", settingsURL, self.userToken, self.userID);
					var data = "";
					request
							.get(
									{
										url : settingsURL,
										headers : {
											token : self.userToken,
											userid : self.userID
										}
									},
									function(error, response, body)
									{
										console.log("Response status code is :%s", response.statusCode);
										if (error == null && response.statusCode == 200)
										{
											var locationData = JSON.parse(response.body);

											console.log("%j",locationData);
											
											data += "<html><body><b>Location Data:</b><br><table><tr><td><b>Lat</b></td><td><b>Long</b></td><td><b>Speed</b></td><td><b>Altitude</b></td><td><b>Gps derived location?</b></td><td><b>Battery level (%)</b></td><td><b>Timestamp</b></td></tr>";

											for (var i = 0; i < locationData.length; i++)
											{
												var row = locationData[i];
												//console.log("Processing row %s", JSON.stringify(row));

												data += "<tr>";
												data += "<td>" + row.latitude + "</td>";
												data += "<td>" + row.longditude + "</td>";
												data += "<td>" + row.speed + "</td>";
												data += "<td>" + row.altitude + "</td>";
												data += "<td>" + row.gpsDerivedLocation + "</td>";
												data += "<td>" + row.batteryLevel + "</td>";
												data += "<td>" + row.timeStamp + "</td>";
												data += "</tr>"
											}
											data += "</table>";

										} else
										{
											console.log(error);
											console.log(response != undefined ? response.body : "body undefined!");
										}
										res.send(data);
									});
				});

app.get('/users', user.list);

http.createServer(app).listen(app.get('port'), function()
{
	console.log('Express server listening on port ' + app.get('port'));
});
