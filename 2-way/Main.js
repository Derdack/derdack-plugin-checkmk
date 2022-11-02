
var request = require('request');

const Result = require('./Result');
var Logger = require('./Logger');

module.exports = {
    onDispose: async function (callback) {
        callback(null, await onDispose());
    },    
    // Useful to let this app be configured in a UI by the user
    onGetAppConfig: async function (callback) {
        callback(null, await onGetAppConfig());
    },
    // Useful to let this app be configured in a UI by the user
    onConfigureApp: async function (callback, context) {
        callback(null, await onConfigureApp(context));
    },
    // Handle various events from EA related to the team or alerts
    onSubscriptionEvent: async function (callback, event) {
        callback(null, await onSubscriptionEvent(event));
    },
    onGetProcessId: function (callback) {
        callback(null, (() => {
            let process = require('process');
            return process.pid;
        })());
    },
    setLogger: (logger) => {
        Logger = logger;
    }
};




// Context with config and callbacks from EA
var appContext = null;

async function onConfigureApp(context)
{
    let fnName = onConfigureApp.name;
    try
    {
        // Save app context locally here in that script. This is not failure save, of course
        //
        appContext = context;

        // Build callbacks that allow us to send events to EA
        //
        if (appContext.state.callbackSaveState != undefined)
            appContext.state.callbackSaveState = eval(appContext.state.callbackSaveState);
        else
            appContext.state.callbackSaveState = () => {};
        
        if (appContext.runtimeInfo.callbackSetStatusError != undefined)
                appContext.runtimeInfo.callbackSetStatusError = eval(appContext.runtimeInfo.callbackSetStatusError);
        else
            appContext.runtimeInfo.callbackSetStatusError = () => {};


        if (appContext.runtimeInfo.callbackSetStatusOK != undefined)
            appContext.runtimeInfo.callbackSetStatusOK = eval(appContext.runtimeInfo.callbackSetStatusOK);
        else
            appContext.runtimeInfo.callbackSetStatusOK = () => {};

        if (appContext.runtimeInfo.callbackSendMail != undefined)
            appContext.runtimeInfo.callbackSendMail = eval(appContext.runtimeInfo.callbackSendMail);
        else
            appContext.runtimeInfo.callbackSendMail = () => {};

		Logger.writeLog(fnName, `Configured Target Url: ${appContext.config.targetUrl}`);        
        return true;
    }
    catch (error)
    {
        Logger.writeLog(fnName, `Error on handling configuration: ${error.message}`);
        return false;
    }
}

async function onGetAppConfig()
{
    // App could update config with e.g. a current connection status
    //
    return appContext.config;
}

// Checkmk configuration
var username = "cmkadmin";
var password = "CNlydVqZ";
var hostName = "211";
var actionCode = 6;
var serverURL = "http://192.168.88.107:8080/cmk/check_mk/api/v0/";
var messageAnnotation = "";
var updateUser = "Ron";

async function onSubscriptionEvent(event) 
{
    let fnName = onSubscriptionEvent.name;

    // Authorization
    checkmkCheckConnection();

    try
    {				
		// Get Event ID 
		var eventId = event.alert.externalEventId;
		Logger.writeLog(fnName, "Value EventID: " + eventId);
				
		// Exit if no ZabbixEventID found
		if (eventId == "") {
			return true;
		}

		// Get Event ID and Checkmk URL
		hostName = getHostName(event.alert.externalEventId);
		Logger.writeLog(fnName, "Value Checkmk Host Name: " + hostName);

		// Exit if no Host Name found
		if (hostName == "") {
			return true;
		}
		
		var strMessage = "";
		if ((event.annotation != undefined) && (event.annotation != null)) {
			strMessage = event.annotation.message
		}

        // Handle this update
        //
		var message = "";
		var actionCode = 0;		
        if (event.eventType === 201 && event.alert.statusCode === 2) {

            Logger.writeLog(fnName, `Alert was acked....`);

            // ------------------
            // Alert acknowledged
            // ------------------

            // Update status
			// Update Checkmk status
			actionCode = 6;
			updateUser = event.user.username;
                        messageAnnotation = "Acknowledged by user: " + updateUser;
			if (strMessage != "") {
                           messageAnnotation += ": " + strMessage;
                        }
			checkmkStatusUpdate();
        }
        else if (event.eventType === 201 && event.alert.statusCode === 4) {

            Logger.writeLog(fnName, `Alert was resolved...`);

            // -------------------
            // Alert was resolved
            // -------------------
            
            // Update status
			// Update Checkmk status
			actionCode = 5;
			updateUser = event.user.username;
                        messageAnnotation = "Closed by user: " + updateUser;
			if (strMessage != "") {
                           messageAnnotation += ": " + strMessage;
                        }
			checkmkStatusUpdate();
        }
		else if (event.eventType === 203) {

            Logger.writeLog(fnName, `Alert was annotated...`);
						
            // -------------------
            // Alert annotated
            // -------------------
            
            // Updata status
			// Update Checkmk status
			actionCode = 4;
			updateUser = event.user.username;
			messageAnnotation = updateUser + ": " + strMessage;
			checkmkStatusUpdate();
        }

		if (actionCode > 0) {
			
			// Forward status update
			//
			sendStatusUpdate(eventId, actionCode, event.user.username, message);
				
			// Trigger email
			/*
			let email = {
				mail: {
					to: 'status_change@enterprisealert.com',
					cc: null,
					subject: 'Alert status update event handled.',
					text: 'ID: ' + eventId + '\r\nAction: ' + actionCode + '\r\nMessage: ' + message + '\r\nUser: ' + event.user.username,
					html: null
				},
				isPlainMail: true
			};

			appContext.runtimeInfo.callbackSendMail(email);
			*/
		}
        return true;
    }
    catch (error)
    {
        Logger.writeLog(fnName, `Error on handling subscription event: ${error.message}`);
        return false;
    }
    finally
    {
        Logger.writeLog(fnName, 'onSubscriptionEvent end');
    }
}

async function onDispose()
{
    let fnName = onDispose.name;

    try
    {
        Logger.writeLog(fnName, 'onDispose start');
        Logger.writeLog(fnName, 'onDispose end');
    }
    catch(error)
    {
        Logger.writeLog(fnName, `Unexpected error on dispose: ${error.message}`);
    }
}



// Send status update
function sendStatusUpdate(eventId, actionCode, user, message) {

	// Send acknowledge or close request

	var data = {
		"jsonrpc": "2.0",
		"method": "update",
		"params": {
			"eventId": eventId,
			"action": actionCode,
			"message": message,
			"user": user
		},
		"id": 1
	}
	
	var options = {
	  method: 'POST',
	  body: data,
	  json: true,
	  url: appContext.config.targetUrl,
	  headers: {
		'Content-Type':'application/json'
	  }
	};

	
	// Acknowledge or close result
	function callbackStatus(error, response, body) {

	    if (response && response.statusCode >= 200 && response.statusCode < 300 && body) {
			console.log("Request to server successful: " + JSON.stringify(body));
		    return;
		}

		if (error) {
			console.log("Error Sending Request to server: " + JSON.stringify(error));		    
			return;
		}
		
		if (body) {
			console.log("Error Sending Request to server: " + JSON.stringify(body));		    
			return;
		}

        console.log("Error Sending Request to server: Unknown");		
	}
    
    // Call the acknowledge or close request
	request(options, callbackStatus);	
}

// Update Checkmk event status
function checkmkStatusUpdate() {
	let fnName = onConfigureApp.name;

	// Checkmk URL
	strCheckmkURL = getCheckmkURL();

	// Send acknowledge or close request

	var data = {
	  'acknowledge_type': 'host',
	  'sticky': false,
	  'persistent': false,
	  'notify': false,
	  'comment': messageAnnotation,
	  'host_name': hostName
	}

	var options = {
	  method: 'POST',
	  body: data,
	  json: true,
	  url: strCheckmkURL + "domain-types/acknowledge/collections/host",
	  headers: {
		'Content-Type':'application/json',
		'Accept': 'application/json',
		'Authorization': 'Bearer ' + username + ' ' + password
	  }
	};

	// Call the acknowledge or close request
	request(options, callbackStatus);
	
	// Acknowledge or close result
	function callbackStatus(error, response, body) {

		Logger.writeLog(fnName, "Checkmk URL: " + strCheckmkURL + "domain-types/acknowledge/collections/host");

		if (body) {
			Logger.writeLog(fnName, "Checkmk response: " + body);
		}
		if (!error && (response.statusCode >= 200) && (response.statusCode <= 299)) {
			
			// Success (body might be empty or undefined)
			Logger.writeLog(fnName, "Acknowledge or close successful. HTTP response code: " + response.statusCode);

			return;
		} else {
			// Acknowledge or close error
			Logger.writeLog(fnName, "Acknowledge or close error: " + error);
		}
	}
}

// Check Checkmk connection
function checkmkCheckConnection() {
	let fnName = onConfigureApp.name;

	// Checkmk URL
	strCheckmkURL = getCheckmkURL();

	// Send a request to check the status of a fake host
	// The HTTP result code 401 indicates an authentication issue

	var options = {
	  method: 'GET',
	  url: strCheckmkURL + "objects/host_config/FakeHostForTesting",
	  headers: {
		  'Accept': 'application/json',
		  'Authorization': 'Bearer ' + username + ' ' + password
	  }
	};

	// Call the acknowledge or close request
	request(options, callbackStatus);
	
	// Acknowledge or close result
	function callbackStatus(error, response, body) {

		Logger.writeLog(fnName, "Checkmk URL: " + strCheckmkURL + "objects/host_config/FakeHostForTesting");

		if (body) {
			Logger.writeLog(fnName, "Checkmk response: " + body);
		}
		
		// HTTP result code 404 or 500 is expected because the fake host does not exist
		if (!error && ((response.statusCode >= 200) && (response.statusCode <= 299)) || ((response.statusCode >= 500) && (response.statusCode <= 599)) || (response.statusCode == 404)) {
			
			// Success (body might be empty or undefined)
			Logger.writeLog(fnName, "Connection test successful. HTTP response code: " + response.statusCode);

			return;
		} else {
			// Error
			if (response && response.statusCode) {
				Logger.writeLog(fnName, "Check error: " + error);
				if (response.statusCode == 401)
				{
					// Authorization error.
					appContext.runtimeInfo.callbackSetStatusError("Authorization error. Please check your credentials.");
					onStopBackgroundJobs();
					return;
				}
				else {
					// Other error.
					appContext.runtimeInfo.callbackSetStatusError("Cannot connect. HTTP Error: " + response.statusCode);
					onStopBackgroundJobs();
					return;
				}
			}
			
			// Unknown error
			appContext.runtimeInfo.callbackSetStatusError("Cannot connect: " + error);
			onStopBackgroundJobs();
			return;
		}
	}
}

// Base URL: // http://<checkmk-server>/cmk/check_mk/api/v0/
function getCheckmkURL() {
	// Checkmk URL
	// Get URL from event
	var strCheckmkURL = serverURL;

	if (strCheckmkURL == "") {
		// Use default URL
		strCheckmkURL = appContext.config.targetUrl;
	}
	
	if (strCheckmkURL == "") {
		// Configuration error
		console.log("Configuration error: Empty URL");
		return;
	}

	// Add '/' at the end if not yet present
	if (strCheckmkURL[strCheckmkURL.length -1] != '/') {
		strCheckmkURL += '/'
	}

	console.log("Checkmk URL: " + strCheckmkURL);

	return strCheckmkURL;
}

// Helper

// Get values from "Checkmk: host_name-host_problem_id-service_problem_id", e.g. "Checkmk: MyHost-1-2"
function getHostName(strExternalID) {

	var strResult = strExternalID;

	// Cut "Checkmk: "
	strResult = strExternalID.replace('Checkmk: ', '');
	
	// Cut everything after the last '-'
	strResult = strResult.substring(0, strResult.lastIndexOf('-'))
	
	// Cut everything after the last '-' again
	strResult = strResult.substring(0, strResult.lastIndexOf('-'))

	console.log("Host name: " + strResult);
	
	return strResult;
	
}

