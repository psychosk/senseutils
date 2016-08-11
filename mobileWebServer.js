/**
 * Module dependencies.
 */
var express = require('express'), routes = require('./routes'), user = require('./routes/user'), http = require('http'), path = require('path');
var forms = require('forms');
var request = require('request');
var util = require('util');
var logger = require('express-logger');
var fileUpload = require('express-fileupload');
var fs = require('fs');
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
app.use(fileUpload());

var logdir = "/var/tmp/mws.log"

app.use(logger({
	path : logdir
}));

var webserverIP = "http://hub.smartsense.co.in:4000/";
var hubEngineIP = "http://hub.smartsense.co.in:7320/";
var trackerEngineIP = "http://tracker.smartsense.co.in:7326/";
var appEngineIP = "http://app.smartsense.co.in:7322/";
var appWSEngineIP = "ws://app.smartsense.co.in:7333/"; // secure web socket;

var sessionData = {};

var self = this;

if (process.env.NODE_ENV === 'dev')
{
	console.log("Using dev environment!");
	webserverIP = "http://localhost:4000/";
	hubEngineIP = "http://localhost:7320/";
	trackerEngineIP = "http://localhost:7326/";
	appEngineIP = "http://localhost:7322/";
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

			if (!error && response && response.statusCode == 200)
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
		console.log("Hitting %s, with email:%s,password:%s", loginURL, emailID, password);

		request.post({
			url : loginURL,
			form : {
				email : emailID,
				password : password
			}
		}, function(error, response, body)
		{
			if (!error && response && response.statusCode == 200)
			{
				var responseParams = JSON.parse(body);
				self.userToken = responseParams.token;
				self.userID = responseParams.id;
				console.log("Login accepted, token is %s and userID is %s", self.userToken, self.userID);
				sessionData[responseParams.id] = {
					token : responseParams.token
				};

				console.log("Session data now looks like %s", JSON.stringify(sessionData));

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

						// data += "" + "<script>" + "var messages = [];
						// function updateMessage(message) {"
						// + " messages.push(message);
						// document.getElementById('messages').innerHTML =
						// messages.toString() ;" + "}" + " var ws = new
						// WebSocket('" + appWSEngineIP + "?userID="
						// + self.userID + "&token=" + self.userToken + "'); " +
						// " ws.onmessage = function (event) { " + "
						// updateMessage(event.data); " + " }; " + "
						// </script></head><body>";

						// var messages = []; function updateMessage(message) {
						// messages.push(message);
						// document.getElementById('messages').innerHTML =
						// messages.toString() ;} var ws = new
						// WebSocket('ws://localhost:7333/?userID=55&token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE0NjkxNjM4Mjk2NTEsImlkIjo1NX0.gdprmSokUfJjHfWlURozaxsqgL2hICfkgsQbNzl7bRk');
						// ws.onmessage = function (event) {
						// updateMessage(event.data); };

						// data += "<script>var messages = []; function
						// updateMessage(message) {"
						// + " messages.push(message);
						// document.getElementById('messages').innerHTML =
						// messages.toString() ;" + "}" + " var mqtt =
						// require('mqtt');var client =
						// mqtt.connect('mqtt://app.smartsense.co.in');
						// client.subscribe('userUpdates/55dev');
						// client.on('message', function(topic,message){
						// updateMessage('Received message:' + message + ' from
						// topic:' + topic)});</script></head><body>";
						//												
						// data += "<strong>Messages (available only on this
						// screen): </strong><div id='messages'></div><br>";

						data += "<b>Your linked gateways (note that the gateway must be connected in order for these commands to work):</b><br>";

						for (var i = 0; i < gateways.length; ++i)
						{
							data += "GatewayName:" + gateways[i].gatewayName + ",GatewayID:" + gateways[i].deviceID + "<a href=\"" + webserverIP + "configure/gateway/" + gateways[i].deviceID
									+ "\">Configure</a>";
							data += "<a href=\"" + webserverIP + "permitjoin/gateway/" + gateways[i].deviceID + "\"> Permit join </a>";
							data += "<a href=\"" + webserverIP + "delete/gateway/" + gateways[i].deviceID + "\"> Unlink (unlinks all paired smartplugs/panicbuttons as well) </a>";
							data += "<a href=\"" + webserverIP + "factoryreset/gateway/" + gateways[i].deviceID + "\"> Factory reset </a>";
							data += "<a href=\"" + webserverIP + "firmwareupdate/gateway/" + gateways[i].deviceID + "\"> Firmware update</a>";
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
							data += "<a href=\"" + webserverIP + "stopsos/panicbutton/" + gatewayID + "/" + deviceID + "\"> Stop sos</a>";
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
							data += "<a href=\"" + webserverIP + "power/smartplug/" + gatewayID + "/" + deviceID + "\">Power</a>  ";
							data += "<a href=\"" + webserverIP + "action/smartplug/" + gatewayID + "/" + deviceID + "/1\"> Switch on</a>  ";
							data += "<a href=\"" + webserverIP + "action/smartplug/" + gatewayID + "/" + deviceID + "/0\"> Switch off</a>"
							data += "<a href=\"" + webserverIP + "delete/device/" + gatewayID + "/" + deviceID + "\"> Unlink</a><br>";

						}

						data += "<b>Your linked cameras</b>:<br>";

						for (var i = 0; i < cameras.length; ++i)
						{
							data += "Name :" + cameras[i].cameraName + ", CameraID:" + cameras[i].deviceID;
							data += "<a href=\"" + webserverIP + "mountsdcard/camera/" + cameras[i].deviceID + "\">mount sd card</a> "
							data += "<a href=\"" + webserverIP + "unmountsdcard/camera/" + cameras[i].deviceID + "\">unmount sd card</a> "
							data += "<a href=\"" + webserverIP + "freespace/camera/" + cameras[i].deviceID + "\">Get free space on sd card</a> "
							data += "<a href=\"" + webserverIP + "deletefile/camera/" + cameras[i].deviceID + "\">Delete file on sd card</a> "
							data += "<a href=\"" + webserverIP + "firmwareupdate/camera/" + cameras[i].deviceID + "\">Firmware update</a> "
							data += "<a href=\"" + webserverIP + "unlink/camera/" + cameras[i].deviceID + "\">Unlink camera</a> "
							data += "<a href=\"" + webserverIP + "listsdcardfiles/camera/" + cameras[i].deviceID + "\">List cloud & sd card files</a> "
							data += "<a href=\"" + webserverIP + "saveconfig/camera/" + cameras[i].deviceID + "\">Save config</a> "
							data += "<a href=\"" + webserverIP + "mirror/camera/" + cameras[i].deviceID + "/0\">Mirror normal</a> "
							data += "<a href=\"" + webserverIP + "mirror/camera/" + cameras[i].deviceID + "/1\">Mirror</a> "
							data += "<a href=\"" + webserverIP + "mirror/camera/" + cameras[i].deviceID + "/2\">Vertical to normal</a> "
							data += "<a href=\"" + webserverIP + "mirror/camera/" + cameras[i].deviceID + "/3\">Vertical of mirror image</a> "
							data += "<a href=\"" + webserverIP + "audio/camera/" + cameras[i].deviceID + "/1\">Audio on</a> "
							data += "<a href=\"" + webserverIP + "audio/camera/" + cameras[i].deviceID + "/0\">Audio off</a> "
							data += "<a href=\"" + webserverIP + "motion/camera/" + cameras[i].deviceID + "/0\">Motion detection on (no recording)</a> "
							data += "<a href=\"" + webserverIP + "motion/camera/" + cameras[i].deviceID + "/1\">Motion detection on (cloud recording)</a> "
							data += "<a href=\"" + webserverIP + "motion/camera/" + cameras[i].deviceID + "/2\">Motion detection off</a> "
							data += "<a href=\"" + webserverIP + "hd/camera/" + cameras[i].deviceID + "/0\">Turn HD recording off</a> "
							data += "<a href=\"" + webserverIP + "hd/camera/" + cameras[i].deviceID + "/1\">Turn HD recording on</a> "
							data += "<a href=\"" + webserverIP + "scheduledrecording/camera/" + cameras[i].deviceID + "\">Scheduled recording settings</a> "

							data += "<br>Your url for WAN HD streaming:<br>Your url for WAN SD streaming:\n"
						}

						data += "<br><b>Your linked trackers:</b><br>";

						for (var i = 0; i < trackers.length; ++i)
						{
							data += "Name :" + trackers[i].trackerName + ",TrackerID:" + trackers[i].deviceID + "<a href=\"" + webserverIP + "configure/tracker/" + trackers[i].deviceID
									+ "\">Configure</a>";
							data += "  <a href=\"" + webserverIP + "location/tracker/" + trackers[i].deviceID + "\">Location data</a>";
							data += "  <a href=\"" + webserverIP + "event/tracker/" + trackers[i].deviceID + "\">Event data</a>";
							data += "  <a href=\"" + webserverIP + "livetracking/tracker/" + trackers[i].deviceID + "/1\">Start live tracking</a>";
							data += "  <a href=\"" + webserverIP + "livetracking/tracker/" + trackers[i].deviceID + "/0\">Stop live tracking</a>";
							data += "  <a href=\"" + webserverIP + "stopsos/tracker/" + trackers[i].deviceID + "\">Stop SOS mode</a>";
							data += "  <a href=\"" + webserverIP + "unlink/tracker/" + trackers[i].deviceID + "\">Unlink tracker</a>";
							data += "  <a href=\"" + webserverIP + "firmwareupdate/tracker/" + trackers[i].deviceID + "\"> Firmware update</a>";
							data += "<br>";

						}

						data += "<br><br><br><b>Upload gateway firmware:</b><br>";
						data += "<form ref='uploadForm' id='uploadForm' action='" + webserverIP + "upload' method='post' encType=\"multipart/form-data\">"
						data += "<input type=\"file\" name=\"sampleFile\" />";
						data += "<br>Version: <input type=\"text\" name=\"version\" />";
						data += "<br>MD5 checksum: <input type=\"text\" name=\"checksum\" />";
						data += "<input type=\"submit\" value=\"Upload!\" />";
						data += "</form>";

						data += "<br><br><br><b>Upload tracker firmware:</b><br>";
						data += "<form ref='uploadForm' id='uploadForm' action='" + webserverIP + "uploadTracker' method='post' encType=\"multipart/form-data\">"
						data += "<input type=\"file\" name=\"sampleFile\" />";
						data += "<br>Version: <input type=\"text\" name=\"version\" />";
						data += "<br>Checksum: <input type=\"text\" name=\"checksum\" />";
						data += "<input type=\"submit\" value=\"Upload!\" />";
						data += "</form>";

						data += "<br><br><br><b>Upload camera kernel firmware:</b><br>";
						data += "<form ref='uploadForm' id='uploadForm' action='" + webserverIP + "uploadCameraKernel' method='post' encType=\"multipart/form-data\">"
						data += "<input type=\"file\" name=\"sampleFile\" />";
						data += "<br>Version: <input type=\"text\" name=\"version\" />";
						data += "<br>Checksum: <input type=\"text\" name=\"checksum\" />";
						data += "<input type=\"submit\" value=\"Upload!\" />";
						data += "</form>";

						data += "<br><br><br><b>Upload camera filesystem firmware:</b><br>";
						data += "<form ref='uploadForm' id='uploadForm' action='" + webserverIP + "uploadCameraFilesystem' method='post' encType=\"multipart/form-data\">"
						data += "<input type=\"file\" name=\"sampleFile\" />";
						data += "<br>Version: <input type=\"text\" name=\"version\" />";
						data += "<br>Checksum: <input type=\"text\" name=\"checksum\" />";
						data += "<input type=\"submit\" value=\"Upload!\" />";
						data += "</form>";
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

app.post('/upload', function(req, res)
{
	console.log("%j", req.files);
	var sampleFile;
	if (!req.files)
	{
		res.send('No files were uploaded.');
		return;
	}
	if (!req.body.version)
	{
		res.send('No version number was provided.');
		return;
	}
	if (!req.body.checksum)
	{
		res.send('No checksum was provided.');
		return;
	}

	sampleFile = req.files.sampleFile;
	var version = req.body.version;
	var checksum = req.body.checksum;

	fs.rename(sampleFile.path, '/var/tmp/gatewayfirmware.' + version, function(err)
	{
		if (err)
		{
			res.status(500).send(err);
		} else
		{
			fs.writeFileSync('/var/tmp/gatewayfirmware.' + version + '.crc', checksum);
			res.send('File uploaded with version number ' + version + ' and checksum ' + checksum);
		}
	});
});

app.post('/uploadTracker', function(req, res)
{
	// console.log("%j",req.files);
	var sampleFile;
	if (!req.files)
	{
		res.send('No files were uploaded.');
		return;
	}
	if (!req.body.version)
	{
		res.send('No version number was provided.');
		return;
	}
	if (!req.body.checksum)
	{
		res.send('No checksum was provided.');
		return;
	}

	sampleFile = req.files.sampleFile;
	var version = req.body.version;
	var checksum = req.body.checksum;

	fs.rename(sampleFile.path, '/var/tmp/trackerfirmware.' + version, function(err)
	{
		if (err)
		{
			res.status(500).send(err);
		} else
		{
			fs.writeFileSync('/var/tmp/trackerfirmware.' + version + '.crc', checksum);
			res.send('File uploaded with version number ' + version + ' and checksum ' + checksum);
		}
	});
});

app.post('/uploadCameraKernel', function(req, res)
{
	// console.log("%j",req.files);
	var sampleFile;
	if (!req.files)
	{
		res.send('No files were uploaded.');
		return;
	}
	if (!req.body.version)
	{
		res.send('No version number was provided.');
		return;
	}
	if (!req.body.checksum)
	{
		res.send('No checksum was provided.');
		return;
	}

	sampleFile = req.files.sampleFile;
	var version = req.body.version;
	var checksum = req.body.checksum;

	fs.rename(sampleFile.path, '/var/tmp/camerakernelfirmware.' + version, function(err)
	{
		if (err)
		{
			res.status(500).send(err);
		} else
		{
			fs.writeFileSync('/var/tmp/camerakernelfirmware.' + version + '.crc', checksum);
			res.send('File uploaded with version number ' + version + ' and checksum ' + checksum);
		}
	});
});

app.post('/uploadCameraFilesystem', function(req, res)
{
	// console.log("%j",req.files);
	var sampleFile;
	if (!req.files)
	{
		res.send('No files were uploaded.');
		return;
	}
	if (!req.body.version)
	{
		res.send('No version number was provided.');
		return;
	}
	if (!req.body.checksum)
	{
		res.send('No checksum was provided.');
		return;
	}

	sampleFile = req.files.sampleFile;
	var version = req.body.version;
	var checksum = req.body.checksum;

	fs.rename(sampleFile.path, '/var/tmp/camerafilesystemfirmware.' + version, function(err)
	{
		if (err)
		{
			res.status(500).send(err);
		} else
		{
			fs.writeFileSync('/var/tmp/camerafilesystemfirmware.' + version + '.crc', checksum);
			res.send('File uploaded with version number ' + version + ' and checksum ' + checksum);
		}
	});
});

var days = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" ];

app.post('/scheduledrecording/camera/fire/:cameraID', function(req, res)
{
	var data = "";
	
	data += util.format("req is :%j",req);
	
	for (var i = 0; i < days.length; ++i)
	{
		var enabled = req[days[i]];
		data += util.format("%s : %s", days[i], enabled);
	}

	var startTime = req.startTime, endTime = req.endTime;
	data += util.format("start:%s,end:%s", startTime, endTime);
	
	res.send(data);
});

app.get('/scheduledrecording/camera/:cameraID', function(req, res)
{
	var data = "";

	var Form = require('form-builder').Form;

	// app.post('/camera/scheduledRecording', camera.setScheduledRecording);

	var myForm = Form.create({
		action : webserverIP + "scheduledrecording/camera/fire/:cameraID",
		method : 'post'
	});

	// opens the form
	data += myForm.open(); // will return: <form action="/signup"

	data += "Day  enabled/disabled<br>"
	// class="myform-class">

	for (var i = 0; i < days.length; i++)
	{
		data += days[i];
		// a group of checkboxes, the formBuilder automatically transform
		// "checklist[]" into "checklist[INDEX]", you can use your own INDEX
		// without problem, see example bellow
		data += myForm.checkbox().attr({
			name : days[i]
		}).render(); // <input type="checkbox" value="1" name="checklist[0]"
						// checked="checked" />

		data += "<br>";
	}
	data += "StartTime:";
	data += myForm.text().attr('name', 'startTime').render();
	data += "<br>EndTime:";
	// add the first field and renders it
	data += myForm.text().attr('name', 'endTime').render() + "<br>"

	data += myForm.submit().attr('value', 'Save settings').render();

	res.send(data);
});

app.get('/motion/camera/:cameraID/:state', function(req, res)
{
	var cameraID = req.params.cameraID;
	var state = req.params.state;

	var motionDetection, recording;
	if (state === "0")
	{
		motionDetection = "1";
		recording = "0";
	} else if (state === "1")
	{
		motionDetection = "1";
		recording = "1";
	} else
	{
		motionDetection = "0";
		recording = "0";
	}

	var settingsURL = appEngineIP + "camera/setMotionDetection";
	request.post({
		url : settingsURL,
		json : {
			cameraID : cameraID,
			motionDetection : motionDetection,
			recording : recording
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("Motion detection action taken!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});

});

app.get('/hd/camera/:cameraID/:state', function(req, res)
{
	var cameraID = req.params.cameraID;
	var state = req.params.state;

	var settingsURL = appEngineIP + "camera/hdRecording";
	request.post({
		url : settingsURL,
		json : {
			cameraID : cameraID,
			state : state
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("HD quality action taken!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});

});

app.get('/audio/camera/:cameraID/:state', function(req, res)
{
	var cameraID = req.params.cameraID;
	var state = req.params.state;

	var settingsURL = appEngineIP + "camera/audio";
	request.post({
		url : settingsURL,
		json : {
			cameraID : cameraID,
			state : state
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("Audio action taken!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});

});

app.get('/mirror/camera/:cameraID/:mirrorParam', function(req, res)
{
	var cameraID = req.params.cameraID;
	var param = req.params.mirrorParam;

	var settingsURL = appEngineIP + "camera/mirror";
	request.post({
		url : settingsURL,
		json : {
			cameraID : cameraID,
			mirrorParam : param
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("Mirroring value set to " + param);
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});

});

app.get('/saveconfig/camera/:cameraID', function(req, res)
{
	var cameraID = req.params.cameraID;

	var settingsURL = appEngineIP + "camera/saveSettings";
	request.post({
		url : settingsURL,
		json : {
			cameraID : cameraID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("Settings saved!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});

});

app.get('/mountsdcard/camera/:cameraID', function(req, res)
{
	var cameraID = req.params.cameraID;

	var settingsURL = appEngineIP + "camera/mountsdcard";
	request.post({
		url : settingsURL,
		json : {
			cameraID : cameraID,
			state : 1
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("SD card mounted!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});

});

app.get('/unmountsdcard/camera/:cameraID', function(req, res)
{
	var cameraID = req.params.cameraID;

	var settingsURL = appEngineIP + "camera/mountsdcard";
	request.post({
		url : settingsURL,
		json : {
			cameraID : cameraID,
			state : 0
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("SD card unmounted!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});

});

app.get('/freespace/camera/:cameraID', function(req, res)
{
	var cameraID = req.params.cameraID;

	var settingsURL = appEngineIP + "camera/freesdcardspace?cameraID=" + cameraID;
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send(body);
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});

});

app.get('/deletefile/camera/:cameraID', function(req, res)
{
	var data = "";
	var cameraID = req.params.cameraID;
	var Form = require('form-builder').Form;

	var myForm = Form.create({
		action : webserverIP + "deletefile/camera/fire/" + cameraID,
		method : 'post'
	});

	// opens the form
	data += myForm.open();

	data += "Filename:";
	data += myForm.text().attr('name', 'filename').render();
	data += myForm.submit().attr('value', 'delete').render();

	res.send(data);
});

app.post('/deletefile/camera/fire/:cameraID', function(req, res)
{
	var cameraID = req.params.cameraID;
	var name = req.body.filename;

	var settingsURL = appEngineIP + "camera/deleterecording";
	request.post({
		url : settingsURL,
		json : {
			key : name,
			location : 'sdcard',
			cameraID : cameraID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("File deleted successfully!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
		}
	});
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
		if (response && response.statusCode == 200)
		{
			res.send("Unlink completed!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
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
		if (response && response.statusCode == 200)
		{
			res.send("Permit join action complete, quick you have 60 seconds!");
		} else
		{
			res.send(util.format("Response:%j, body:%j", response, body));
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
	var settingsURL = appEngineIP + "gateway/settings";
	request.post({
		url : settingsURL,
		json : {
			ssid : ssid,
			password : password,
			name : name,
			gatewayID : gatewayID
		},

		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		res.send(util.format("error:%s,response:%j", error, response));
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

			var params = body;
			console.log(JSON.stringify(params));

			var data = JSON.stringify(params) + "<br>";
			// var data = "NAME:" + params.name + ",WIFI SSID:" + params.SSID +
			// ",WIFI PASS:" + params.KEY + "<br>";

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
			data += util.format("%j", body);
		}
		res.send(data);
	});

});

app.get('/firmwareupdate/gateway/:gatewayID', function(req, res)
{
	var gatewayID = req.params.gatewayID;

	console.log("Asking gatewayID:%s to update firmware", gatewayID);
	var url = appEngineIP + "gateway/firmwareUpdate";
	request.post({
		url : url,
		json : {
			gatewayID : gatewayID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		res.send(util.format("error:%s,response:%j", error, response));
	});

});

app.get('/firmwareupdate/camera/:cameraID', function(req, res)
{
	var cameraID = req.params.cameraID;

	console.log("Asking cameraID:%s to update firmware", cameraID);
	var url = appEngineIP + "camera/firmware/upgrade";
	request.post({
		url : url,
		json : {
			cameraID : cameraID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		res.send(util.format("error:%s,response:%j", error, response));
	});

});

app.get('/unlink/camera/:cameraID', function(req, res)
{
	var cameraID = req.params.cameraID;

	console.log("Asking cameraID:%s to unlink", cameraID);
	var url = appEngineIP + "camera/unlink";
	request.post({
		url : url,
		json : {
			cameraID : cameraID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		res.send(util.format("error:%s,response:%j", error, response));
	});

});

app.get('/listsdcardfiles/camera/:cameraID', function(req, res)
{
	var cameraID = req.params.cameraID;

	console.log("Asking cameraID:%s to unlink", cameraID);
	var url = appEngineIP + "camera/recordings?cameraID=" + cameraID;

	request.get({
		url : url,
		json : {
			cameraID : cameraID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		res.send(util.format("error:%s,response:%j", error, response));
	});

});

app.get('/firmwareupdate/tracker/:userTrackerPairID', function(req, res)
{
	var data = "";
	var userTrackerPairID = req.params.userTrackerPairID;
	var Form = require('form-builder').Form;

	var myForm = Form.create({
		action : webserverIP + 'firmwareupdate/tracker/fire/' + userTrackerPairID,
		method : 'post'
	});

	// opens the form
	data += myForm.open();

	data += "Enter version number to upgrade to...<br>";

	data += "Version number:"
	data += myForm.text().attr('name', 'fwVersion').render() + "<br>";
	data += myForm.submit().attr('value', 'upgrade').render();

	res.send(data);

});

app.post('/firmwareupdate/gateway/fire/:gatewayID', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var fwVersion = req.body.fwVersion;

	console.log("Asking gatewayID:%s to update to fwVersion:%s", gatewayID, fwVersion);
	var url = appEngineIP + "gateway/firmwareUpdate";
	request.post({
		url : url,
		json : {
			gatewayID : gatewayID,
			version : fwVersion
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		res.send(util.format("error:%s,response:%j", error, response));
	});
});

app.post('/firmwareupdate/tracker/fire/:userTrackerPairID', function(req, res)
{
	var userTrackerPairID = req.params.userTrackerPairID;
	var fwVersion = req.body.fwVersion;

	console.log("Asking userTrackerPairID:%s to update to fwVersion:%s", userTrackerPairID, fwVersion);
	var url = appEngineIP + "tracker/firmware/upgrade";
	request.post({
		url : url,
		json : {
			TID : userTrackerPairID
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		res.send(util.format("error:%s,response:%j", error, response));
	});
});

app.get('/stopsos/panicbutton/:gatewayID/:deviceID', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;
	var settingsURL = appEngineIP + "panicbutton/stopsos";
	console.log("Going to %s", settingsURL);
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
		if (response && response.statusCode == 200)
		{
			res.send("stopSOS executed successfully!");
		} else
		{
			res.send("Error executing stopSOS:%s", body);
		}
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
		if (response && response.statusCode == 200)
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
		if (response && response.statusCode == 200)
		{
			res.send("Configuration set successfully, now go back and refresh!");
		} else
		{
			res.send("Error setting configuration:%s", body);
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
		if (response && response.statusCode == 200)
		{
			res.send("Device deleted successfully!");
		} else
		{
			res.send("Error deleting device:%s", body);
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
			name : name,
		},
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			res.send("Configuration set successfully!");
		} else
		{
			res.send("Error setting configuration:%s", body);
		}
	});
});

var getPanicButtonName = function(gatewayID, deviceID, callback)
{
	var settingsURL = appEngineIP + "panicbutton/getName?gatewayID=" + gatewayID + "&deviceID=" + deviceID;
	// console.log("Going to %s",settingsURL);
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (response && response.statusCode == 200)
		{
			console.log("Got back %j from call", body);
			callback(null, body);
		} else
		{
			callback(response);
		}
	});
};

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
			data += myForm.submit().attr('value', 'change').render();

		} else
		{
			data += body;
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
			data += body;
		}
		res.send(data);
	});
});

app.get('/action/smartplug/:gatewayID/:deviceID/:action', function(req, res)
{
	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;
	var action = req.params.action;

	var url = appEngineIP + "smartPlug/controlDevice";
	console.log("Going to %s", url);
	request.post({
		url : url,
		headers : {
			token : self.userToken,
			userid : self.userID
		},
		json : {
			gatewayID : gatewayID,
			deviceID : deviceID,
			action : action
		}
	}, function(error, response, body)
	{
		if (error)
		{
			res.status(400).send("Smart plug action error:" + error);
		} else if (response && response.statusCode != 200)
		{
			res.send(util.format("Response status code : %s, body : %s", response.statusCode, body));
		} else
		{
			res.send("Smart plug action accepted!");
		}
	});

});

app.get('/power/smartplug/:gatewayID/:deviceID', function(req, res)
{

	// gateway/settings/:gatewayID

	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;
	var settingsURL = appEngineIP + "smartPlug/powerDetails?gatewayID=" + gatewayID + "&deviceID=" + deviceID;
	console.log("Going to %s", settingsURL);
	request.get({
		url : settingsURL,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (error)
		{
			res.status(400).send("Smart plug power error:" + error);
		} else if (response && response.statusCode != 200)
		{
			res.send(util.format("Response status code : %s, body : %s", response.statusCode, body));
		} else
		{
			res.send(body);
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
	console.log("Received body:%j", req.body);

	var userTrackerPairID = req.params.userTrackerPairID;

	var emergencyContact1 = req.body.emergencyContact1;
	var emergencyContact2 = req.body.emergencyContact2;
	var emergencyContact3 = req.body.emergencyContact3;
	var emergencyContact4 = req.body.emergencyContact4;
	var emergencyContact5 = req.body.emergencyContact5;
	var callTimeout = req.body.callTimeout;
	var heartbeat = req.body.heartbeat;
	var callInEnabled = req.body.callInEnabled;
	var name = req.body.name;

	var settings = {
		emergencyContact1 : emergencyContact1,
		emergencyContact2 : emergencyContact2,
		emergencyContact3 : emergencyContact3,
		emergencyContact4 : emergencyContact4,
		emergencyContact5 : emergencyContact5,
		callTimeout : callTimeout,
		heartbeat : heartbeat,
		callInEnabled : callInEnabled,
		name : name,
		tid : userTrackerPairID
	};

	console.log("Setting tracker configuration details to %j", settings);
	var settingsURL = appEngineIP + "tracker/settings";
	request.post({
		url : settingsURL,
		json : settings,
		headers : {
			token : self.userToken,
			userid : self.userID
		}
	}, function(error, response, body)
	{
		if (error == null && response && response.statusCode == 200)
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
			var callTimeout = responseParams.callTimeout;
			var heartbeat = responseParams.heartbeat;
			var callinEnabled = responseParams.callInEnabled;
			var name = responseParams.name;

			var data = "Existing settings...<br>"
			if (emergencyContact1 == null)
			{
				data += "No existing settings...";
			} else
			{
				data += "Name:" + name + "<br>Emergency contact 1:" + emergencyContact1 + "<br>emergency contact 2:" + emergencyContact2 + "<br>emergency contact 3:" + emergencyContact3
						+ "<br>emergency contact 4:" + emergencyContact4 + "<br>emergencyContact 5:" + emergencyContact5 + "<br>callTimeout:" + callTimeout + "<br>heartbeat:" + heartbeat
						+ "<br>callinEnabled:" + callinEnabled + "<br>";
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

			data += "Name:";
			data += myForm.text().attr('name', 'name').render() + "<br>";
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
		} else if (response && response.statusCode != 200)
		{
			res.send(util.format("Response status code : %s, body : %s", response.statusCode, body));
		} else
		{
			res.send("Tracker action accepted!");
		}
	});
});

app.get('/unlink/tracker/:userTrackerPairID', function(req, res)
{
	var url = appEngineIP + "tracker/unlink";
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
			res.status(400).send("Tracker unlink error:" + error);
		} else if (response && response.statusCode != 200)
		{
			res.send(util.format("Response status code : %s, body : %s", response.statusCode, body));
		} else
		{
			res.send("Tracker unlink accepted!");
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
		} else if (response && response.statusCode != 200)
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
				// console.log("Processing row %s", JSON.stringify(row));

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
					// console.log("Going to %s with %s and %s", settingsURL,
					// self.userToken, self.userID);
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
										console.log("Response status code is :%s", response && response.statusCode);
										if (error == null && response && response.statusCode == 200)
										{
											var locationData = JSON.parse(response.body);

											console.log("%j", locationData);

											data += "<html><body><b>Location Data:</b><br><table><tr><td><b>Lat</b></td><td><b>Long</b></td><td><b>Speed</b></td><td><b>Altitude</b></td><td><b>Gps derived location?</b></td><td><b>Battery level (%)</b></td><td><b>Timestamp</b></td></tr>";

											for (var i = 0; i < locationData.length; i++)
											{
												var row = locationData[i];
												// console.log("Processing row
												// %s", JSON.stringify(row));

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
