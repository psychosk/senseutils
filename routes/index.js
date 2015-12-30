/*
 * GET home page.
 */

var Form = require('form-builder').Form;
var request = require('request');

exports.index = function(req, res)
{
	var data = "";
	
	var myForm = Form.create({action: 'http://localhost:4000/user/registerUser', method: 'post'}, {
	    user: {email: 'my@email.com',password: '...'}
	});
	// opens the form  
	data += myForm.open(); // will return: <form action="/signup" class="myform-class"> 
	 
	data += "Email:";
	
	// add the first field and renders it 
	data += myForm.email().attr('email', 'user[email]').render(); // will return: <input type="text" name="user[firstName]" value="Lucas" /> 
	 
	data += "<br>Password:";
	
	// add the last name field and renders it 
	data += myForm.password().attr('password', 'user[lastName]').render(); // will return: <input type="text" name="user[lastName]" value="Pelegrino" /> 

	data += "<br>";
	 
	data += myForm.submit().attr('value','create account/login').render();
	
	// closes form 
	data +=myForm.end(); // returns </form> 
	
	res.send(data);
};