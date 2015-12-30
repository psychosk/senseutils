# senseutils

This package consists of a 
- webserver that emulates a mobile app
- hub/panicbutton/smartplug device simulator

webserver

The webserver is up and running on http://hub.smartsense.co.in:4000

This sample mobile app allows you to:
- create an account (gives you a unique userID)
- See/Configure which gateways you have linked to this account
- See/Configure and see an audit trail of all panic buttons you have linked to your account
- See/Configure and see an audit trail of all smart plugs you have linked to your account
- See/Configure which cameras you have linked to your account
- See/Configure which trackers you have linked to your account

hub/panicbutton/smartplug DEVICE SIMULATOR

Prerequisites:
You should have installed node.js and npm on your system. 
Clone the project into a directory
Run these commands:
npm install ws --save
npm install prompt --save

hubDevice.js

This acts as a hardware simulator for the :
i)   hub (aka gateway)
		You can simulate events such as : 
			- adding a panic button
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
i)   userID
ii)  gatewayMAC
iii) privateIP of the gateway

For example
node ./hubDevice.js 16 aa:bb:732 192.121.168.232


