/**
 * Module dependencies.
 */

var express = require('express'), routes = require('./routes'), user = require('./routes/user'), http = require('http'), path = require('path');
var forms = require('forms');
var request = require('request');
var app = express();

// all environments
app.set('port', process.env.PORT || 4000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

var logdir = "/var/tmp/hubEngine.log"

var ip = "http://54.169.79.151:4000/";
var hubEngineIP = "http://hub.smartsense.co.in:7320/";

if (process.env.NODE_ENV === 'dev')
{
	console.log("Using dev environment!");
	ip = "http://localhost:4000/";
	hubEngineIP = "http://localhost:7320/";
	app.use(express.errorHandler());
}



app.get('/', function(req, res)
{

	var data = "";

	var Form = require('form-builder').Form;

	var myForm = Form.create({
		action : ip + "user/registerUser",
		method : 'post'
	}, {
		user : {
			email : 'my@email.com',
			password : '...'
		}
	});
	// opens the form
	data += myForm.open(); // will return: <form action="/signup"
	// class="myform-class">

	data += "Email:";

	// add the first field and renders it
	data += myForm.email().attr('name', 'emailID').render();
	data += "<br>Password:";

	// add the last name field and renders it
	data += myForm.password().attr('name', 'password').render();
	data += "<br>";

	data += myForm.submit().attr('value', 'create account/login').render();

	// closes form
	data += myForm.end(); // returns </form>

	res.send(data);
});

// global!
var userID = null;

app.post('/user/registerUser', function(req, res)
{
	var emailID = req.body.emailID;
	var password = req.body.password;
	var registerURL = hubEngineIP + "user/registerUser/" + emailID + "/" + password;
	request.post(registerURL, function(error, response, body)
	{
		if (!error && response.statusCode == 200)
		{
			var responseParams = JSON.parse(body);
			userID = responseParams.userID;
			console.log("Registration accepted, userID:%s", userID);

			var data = "";
			data += "<b>YOUR USERID IS:" + userID + "</b><br>";

			var getDevicesUrl = ip +"user/alldevices/" + userID;
			var request2 = require('request');
			request2.get(hubEngineIP+"/user/alldevices/" + userID, function(error, response, body)
			{
				var gateways = [];
				var cameras = [];
				var trackers = [];
				var panicbuttons = [];
				var smartplugs = [];

				var params = JSON.parse(response.body);
				for (var i = 0; i < params.length; i++)
				{
					var row = params[i];
					if (row.type === 'gateway')
					{
						gateways.push(row.deviceID);
					} else if (row.type === 'tracker')
					{
						trackers.push(row.deviceID);
					} else if (row.type === 'camera')
					{
						cameras.push(row.deviceID);
					} else if (row.type === 'PA')
					{
						panicbuttons.push({
							deviceID : row.deviceID,
							gatewayID : row.linkedGatewayID
						});
					} else if (row.type === 'SM')
					{
						smartplugs.push({
							deviceID : row.deviceID,
							gatewayID : row.linkedGatewayID
						});
					} else
					{
						console.log("Unknown type:%s", row.type);
					}
				}

				data += "<b>Your linked gateways:</b><br>";

				for (var i = 0; i < gateways.length; ++i)
				{
					data += "GatewayID:" + gateways[i] + "<a href=\"" + ip +"configure/gateway/" + gateways[i] + "\">Configure</a><br>"
				}

				data += "<b>Your linked panic buttons:</b><br>";

				for (var i = 0; i < panicbuttons.length; ++i)
				{
					var deviceID = panicbuttons[i].deviceID;
					var gatewayID = panicbuttons[i].gatewayID;
					data += "DeviceID:" + deviceID + "<a href=\"" + ip +"configure/panicbutton/" + gatewayID + "/" + deviceID + "\">Configure</a>  "
					data += "<a href=\"" + ip +"info/panicbutton/" + gatewayID + "/" + deviceID + "\">Info</a><br>";
				}

				data += "<b>Your linked smart plugs:</b><br>";

				for (var i = 0; i < smartplugs.length; ++i)
				{
					var deviceID = smartplugs[i].deviceID;
					var gatewayID = smartplugs[i].gatewayID;
					data += "DeviceID:" + deviceID + "<a href=\"" + ip +"configure/smartplug/" + gatewayID + "/" + deviceID + "\">Configure</a>  "
					data += "<a href=\"" + ip + "info/smartplug/" + gatewayID + "/" + deviceID + "\">Info</a><br>";
				}

				data += "<b>Your linked cameras</b>:<br>";

				for (var i = 0; i < cameras.length; ++i)
				{
					data += "CameraID:" + cameras[i] + "<a href=\"" + ip + "configure/camera/" + cameras[i] + "\">Configure</a><br>"
				}

				data += "<b>Your linked trackers:</b><br>";

				for (var i = 0; i < trackers.length; ++i)
				{
					data += "TrackerID:" + trackers[i] + "<a href=\"" + ip +"/configure/tracker/" + trackers[i] + "\">Configure</a><br>"
				}
				res.send(data);

			});

		} else
		{
			console.log("STATUSCODE:%s", response.statusCode);
			res.send("STATUSCODE:" + response.statusCode + ",ERR:" + error);
		}
		;
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

	console.log("Setting gateway to %s,%s", ssid, password);
	var settingsURL = hubEngineIP + "gateway/settings/" + gatewayID;
	request.post({
		url : settingsURL,
		form : {
			ssid : ssid,
			password : password
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
	var settingsURL = hubEngineIP + "gateway/settings/" + gatewayID;
	request.get(settingsURL, function(error, response, body)
	{
		var data = "";
		if (response.statusCode == 200)
		{

			var params = JSON.parse(body);
			var data = "WIFI SSID:" + params.SSID + ",WIFI PASS:" + params.KEY + "<br>";

			var Form = require('form-builder').Form;

			var myForm = Form.create({
				action : ip + "configure/gateway/modifysettings/" + gatewayID,
				method : 'post'
			});

			// opens the form
			data += myForm.open(); // will return: <form action="/signup"
			// class="myform-class">

			data += "SSID:";

			// add the first field and renders it
			data += myForm.text().attr('name', 'ssid').render();
			data += "<br>WIFI Password:";

			// add the last name field and renders it
			data += myForm.text().attr('name', 'password').render();
			data += "<br>";

			data += myForm.submit().attr('value', 'change').render();

		} else
		{
			data += "Error:" + JSON.parse(body).error;
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
	var settingsURL = hubEngineIP + "panicbutton/history/" + gatewayID + "/" + deviceID;
	console.log("Going to %s", settingsURL);
	request.get(settingsURL, function(error, response, body)
	{
		// console.log(body);
		// console.log("Got response!");
		var data = "<table>";
		if (response.statusCode == 200)
		{
			var params = JSON.parse(response.body);
			for (var i = 0; i < params.length; i++)
			{
				var row = params[i];
				data += "<tr>";
				var event = "";
				if (params[i].event === 'PA')
					event = "Panic button press";
				else if (params[i].event === 'SU')
					event = "IVR success";
				else if (params[i].event === 'FL')
					event = "IVR failure";
				else if (params[i].event === 'FA')
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

/**
 * get the settings from the server
 */
app.get('/configure/panicbutton/:gatewayID/:deviceID', function(req, res)
{

	// gateway/settings/:gatewayID

	var gatewayID = req.params.gatewayID;
	var deviceID = req.params.deviceID;
	var settingsURL = hubEngineIP + "panicbutton/settings/" + gatewayID + "/" + deviceID;
	// console.log("Going to %s",settingsURL);
	request.get(settingsURL, function(error, response, body)
	{
		var data = "";
		if (response.statusCode == 200)
		{

			var params = JSON.parse(body);
			if (params.length == 0)
			{
				// res.send("No configuration yet!");
				data += "No configuration yet<br>";
			} else
			{
				data += JSON.stringify(params);
				// data += "Emergency contact 1:" +
			}

			// data += "Emergency contact 1 " + params.emerg

			// var data = "WIFI SSID:" + params.SSID + ",WIFI PASS:" +
			// params.KEY + "<br>";
			//
			var Form = require('form-builder').Form;

			var myForm = Form.create({
				action : ip + "configure/panicbutton/settings/" + gatewayID + "/" + deviceID,
				method : 'post'
			});

			// opens the form
			data += myForm.open();

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

/**
 * Change settings of gateway
 */
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

	// console.log("Setting gateway to %s,%s", ssid, password);
	var settingsURL = hubEngineIP + "panicbutton/settings/" + gatewayID + "/" + deviceID;
	request.post({
		url : settingsURL,
		form : {
			p1 : emergencyContact1,
			p2 : emergencyContact2,
			p3 : emergencyContact3,
			p4 : emergencyContact4,
			p5 : emergencyContact5,
			adminNumber : adminNumber,
			timeout : callTimeout
		}
	}, function(error, response, body)
	{
		if (error)
			res.send(error);
		else if (response.statusCode == 200)
			res.send("Panic button configuration set successfully!");
		else
			res.send(400);
	});

});

app.get('/users', user.list);

http.createServer(app).listen(app.get('port'), function()
{
	console.log('Express server listening on port ' + app.get('port'));
});
