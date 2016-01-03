# senseutils

This package consists of a 
- mobile app simulator
- hub/panicbutton/smartplug device simulator

The mobile app does almost everything you can do through the real mobile app.
The simulator actually performs most of the actions that the real devices will do. It sends messages to the cloud and waits for any incoming messages from the cloud.

# quick start guide

1) Follow the instructions on the mobile app simulator to create an account for yourself. Note the userID it prints on the screen.
2) Startup the gateway simulator with this userID (along with any fake mac address and fake private ip address). This will register this gateway with your userid.
3) Refresh the device listing screen on the mobile app, your gateway will now be listed.
4) Configure the gateway just added if you wish through the mobile app. 
5) Next, in the gateway simulator, add in a panic button and smart plug.
6) Refresh the device listing screen on the mobile app, your panic button and smart plug will now be added. You can take actions on them as you wish.
7) Next, start the tracker simulator with the same userID (along with any fake IMEI number but real phone number). After registration, you will be able to refresh the device listing screen on the mobile app and see the newly configured tracker.

# mobile app simulator

It is up and running on *http://hub.smartsense.co.in:4000*

This sample mobile app allows you to:
- create an account with smartsense 
	Gives you a unique userID, you can use this userID to startup a hub simulator 
- See/Configure gateways
	Configure the wifi ssid/password
- See/Configure panic buttons
	Configure the settings for the panic button
- See audit trail of panic buttons
	See when panic buttons were pressed, what happened with the ivr call tree, what happened with falls etc
- Disable panic button SOS mode (to be implemented)
- See smart plugs 
- See audit trail of smart plugs
- Switch on/off smart plugs
	This will actually send a message to the cloud which will then send a message to a smart plug (or a smart plug emulator) to tell it to switch on or off.	
- See/Configure trackers
	Configure tracker options (emergency contact info, admin contact, call timeout, heartbeat, etc)
- See audit trail of tracker events and location data 
	See what events happened with a tracker. See historical location data for the tracker.
- See/Configure cameras (to be implemented)

# device simulators

## Prerequisites:
You should have installed node.js and npm on your system. 
Clone this project into a directory (ie git clone https://github.com/psychosk/senseutils.git)
Go into that directory.
Install all npm dependencies (ie npm install)

## hubDevice.js

This acts as a hardware simulator for a gateway, smart plug and panic button device:
i)   hub (aka gateway)
		You can simulate events such as : 
			- adding a panic button. 
			- adding a smart plug
ii)  panic button
		You can simulate events such as :
			- invoking a panic button event
			- invoking a IVR success event
			- invoking a IVR failure event
			- invoking a Fall detected event
			- invoking a Fall False Alarm event
iii) smart plug
		You can simulate events such as :
			- manually switching on or off the load connected to the smart plug

To startup the simulator, you need to execute hubDevice.js with the following arguments:
i)   userID (which you can obtain by registering for an account through the website)
ii)  gatewayMAC (any freeform string for now)
iii) privateIP of the gateway (any freeform string for now)

For example
node ./hubDevice.js 16 aa:bb:732 192.121.168.232

It will present you with a list of options for commands that you can run.

Command : 'registerDevice'
Allows you to simulate the registration of a new smart plug or panic button as long as you are able to provide the unique 'zigbee radio id' of the device.

Command : 'panicButtonAction'
After picking a panic button that is currently linked to the gateway that you are simulating, it allows you to simulate a panic button action (buttonpress,ivrsuccess,ivrfailure,falldetected,fallfalsealarm,lowbattery).

Command : 'smartPlugAction'
After picking a smart plug that is currently linked to the gateway that you are simulating, it allows you to manually switch on or switch off the load connected to the smartplug.

## trackerDevice.js
This acts as a hardware simulator for a tracker.

With this simulator, you can emulate:
- Emulating a panic button press
- Emulating IVR success or IVR failure (to be implemented)
- Emulating posting in a location update (complete with latitude, longtitude, speed, altitude, battery level, gps source, etc).

To startup the tracker simulator, you need to pass the following arguments:
i)   the IMEI number (any free form string for now)
ii)  the phone number of the tracker (should be a proper phone number (eg +919987792049))
iii) your userID

For example:
node ./trackerDevice IMEI10001 +919987792049 16

After starting up, the cloud will send you an ACTIVATION message on the phone number that you provide. The simulator will then request that number from you. After that, the simulator will start.

