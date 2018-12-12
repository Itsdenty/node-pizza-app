/*
* These are workers related files
*
*/

// Dependencies
const path = require('path'),
  fs = require('fs'),
  https = require('https'),
  http = require('http'),
  url = require('url'),
  util = require('util'),
  debug = util.debuglog('workers'),
  _data = require('./data'),
  _logs = require('./logs'),
  helpers = require('./helpers');

// Instantiate the worker object
const workers = {};

// lookup all checks, get their data and send to a validator
workers.gatherAllChecks = () => {
  // Get all the checks that exists in the system
  _data.list('checks', (err, checks) => {
    if(!err && checks && checks.length > 0) {
      checks.forEach((check)=> {
        // Read in the check data
        _data.read('checks', check, (err, originalCheckData) => {
          if(!err && originalCheckData) {
            // Pass it to the check validator, and let that function continue or log error
            workers.validateCheckData(originalCheckData);
          } else {
            debug('Error reading one of the check data')
          }
        })
      })
    } else {
      debug("Error: could not find any checks to process");
    }
  })
}

// Sanity-check the check-data
workers.validateCheckData = (originalCheckData) => {
  originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData != null ? originalCheckData : {};
  originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length > 0 ? originalCheckData.id.trim() : false;
  originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
  originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 11 ? originalCheckData.userPhone.trim() : false;
  originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
  originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > 0 ? originalCheckData.method : false;
  originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : [];
  originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 == 0 && originalCheckData.timeoutSeconds > 0 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

  // Set the keys that may not be set (if the workers have never seen this check before)
  originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
  originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

  // if all the checks pass, pass the data along to the next step in the process
  if ( originalCheckData.id &&
      originalCheckData.userPhone && 
      originalCheckData.protocol &&
      originalCheckData.url && 
      originalCheckData.method &&
      originalCheckData.successCodes &&
      originalCheckData.timeoutSeconds){
        workers.performCheck(originalCheckData);
      } else {
        debug('Error: one of the checks is not properly formatted. skipping it');
      }
}

// Perform the check, send the original check data and the outcome of the check process to the next step
workers.performCheck = (originalCheckData) => {
  // Prepare the initial check outcome
  const checkOutcome = {
    'error' : false,
    'responseCode' : false
  }

  // Mark that the outcome has not been sent yet
  let outcomeSent = false;

  // parse the hostname and the path out of the original checkdata
  const parsedUrl = url.parse(`${originalCheckData.protocol}://${originalCheckData.url}`, true),
    hostname = parsedUrl.hostname,
    path = parsedUrl.path;//using path and not pathname because we want the query string]
  // Construct the request
  const requestDetails = {
    'protocol' : `${originalCheckData.protocol}:`,
    hostname,
    path,
    'timeout' : originalCheckData.timeoutSeconds * 1000
  };

  // instantiate the request object using either the http or https module
  const _moduleToUse = originalCheckData.protocol == 'http' ? http : https,
    req = _moduleToUse.request(requestDetails, (res) => {
    // Grab the status of the sent request
    const status = res.statusCode;

    //update the checkOutcome and pass the data along
    checkOutcome.responseCode = status;
    if(!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // Bind to the error event so it doesn't get thrown
  req.on('error', (err) => {
    // update the checkoutcome and pass the data along
    checkOutcome.error = {
      'error' : true,
      'value' : e
    };
    if(!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  })

  // bind to the timeout event
  req.on('timeout', (err) => {
    // update the checkoutcome and pass the data along
    checkOutcome.error = {
      'error' : true,
      'value' : 'timeout'
    };
    if(!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  })

  //End the request
  req.end();

  // process the check outcome and trigger an alert to the user as needed
  // accomodate checks that has never been tested before, we don't want to alert on that
  workers.processCheckOutcome = (originalCheckData, checkOutcome) => {
    // Decide if the check is down in the currentState
    const state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';
    
    // Decide if an alert is wanted
    var alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;
    
    // log the outcome 
    const timeOfCheck = Date.now();
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

    // Update the check data
    const newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = timeOfCheck;

    // Save the updates
    _data.update('checks', newCheckData.id, newCheckData, (err) => {
      if(!err) {
        // Send the new check data to the next phasse in the process if needed
        if(alertWarranted) {
          workers.alertUserToStatusChange(newCheckData);
        } else {
          debug('Check outcome has not changed, no alert needed')
        }
      } else {
        debug('Error trying to save updates to one of the checks');
      }
    })
  }
}

// Alert the user as to a change in their check status
workers.alertUserToStatusChange = (newCheckData) => {
  const msg = `Alert: your check for: ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}`; 
  helpers.sendTwiliosSms(newCheckData.userPhone, msg, (err) => {
    if(!err) {
      debug(`Success user was alert to a change in their check via sms ${msg}`);
    } else {
      debug('Error: Could not send sms to alert user to a change in their checks');
    }
    
  });
}

workers.log = (originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) => {
  const logData = {
    'check' : originalCheckData,
    'outcome' : checkOutcome,
    state,
    'alert' : alertWarranted,
    'time' : timeOfCheck
  }

  // Convert data to a string
  const logString = JSON.stringify(logData);

  // Determine the name of the log file
  const logFileName = originalCheckData.id;

  // Append the log string to the file
  _logs.append(logFileName, logString, (err) => {
    if (!err) {
      debug('Logging to file succeeded');
    } else {
      debug('logging to file failed');
    }
  })
}
// Timer to execute the worker-process once per minute
workers.loop = () => {
  setInterval(()=>{
    workers.gatherAllChecks();
  }, 1000 * 60);
}

// Rotate (compress) the log files
workers.rotateLogs = function() {
  // List all the (non compressed) log files
  _logs.list(false, (err, logs) => {
    if (!err && logs && logs.length > 0) {
      logs.forEach((logName) => {
        // Compress the data to a different file
        const logId = logName.replace('.log', ''),
          newFileId = `${logId}-${Date.now()}`;
        _logs.compress(logId, newFileId, (err) => {
          if(!err) {
            // Truncate the log 
            _logs.truncate(logId,(err) => {
              if(!err) {
                debug('Success truncating log file');
              } else {
                debug('Error truncating log file');
              }
            })
          } else{
            debug('Error compressing one of the log files', err);
          }
        })

      })
    } else{
      debug('Error: could not find logs to compress');
    }
  })
}

// Timer to execute the log-rotation process once per day
workers.logRotationLoop = () => {
  setInterval(()=>{
    workers.gatherAllChecks();
  }, 1000 * 60 * 60 * 24);
}

// Init script
workers.init = () => {

  // Send to console, in yellow
  console.log('\x1b[33m%s\x1b[0m', 'Background workers are running');

  // Execute all the checks immediately
  workers.gatherAllChecks();

  // Call the loop so the checks will execute later on
  workers.loop();

  // Compress all the logs immediately
  workers.rotateLogs();

  // call the compression loops so logs would be compressed later on
  workers.logRotationLoop();
}

// Export the module
module.exports = workers;