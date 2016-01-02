# senseutils

This package consists of a 
- webserver that acts like a mobile application
- hub/panicbutton/smartplug device simulator

# mobile application

It is up and running on *http://hub.smartsense.co.in:4000*

This sample mobile app allows you to:
- create an account with smartsense (gives you a unique userID, you can use this userID to startup a hub simulator - see documentation on DEVICE SIMULATOR)
- See/Configure gateways
- See/Configure panic buttons
- See audit trail of panic buttons
- See/configure smart plugs 
- See audit trail of smart plugs
- See/Configure trackers
- See audit trail of tracker events and location data 
- See/Configure cameras 

# device simulators

## Prerequisites:
You should have installed node.js and npm on your system. 
Clone the project into a directory
Run these commands:
npm install 

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

It maintains full connectivity with the cloud and prints out what RESTFUL web service calls it is making or what data it may be sending down a websocket connection.
						
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