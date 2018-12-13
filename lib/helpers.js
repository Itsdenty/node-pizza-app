/*
* Helpers for various tasks
*
*/


// Dependencies
const crypto = require('crypto'),
  https = require('https'),
  queryString = require('querystring'),
  config = require('./config');

// Container for all the helpers

const helpers = {};

// Create SHA256 hash
helpers.hash = function(str){
  if(typeof(str) == 'string' && str.length > 0) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  }  else {
    return false;
  };
}
  // Parse a JSON string to an object in all cases without throwing
  helpers.parseJsonToObject = (str) => {
    try{
      var obj = JSON.parse(str);
      return obj
    } catch(e) {
      return {};
    }
  };

  // Create a string of random alphanumeric characters of a given length
  helpers.createRandomString = (strLength) => {
    strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
    if(strLength) {
      //Define all the possible characters that could go into a string
      const possibleCharacters = 'abdcdefghijklmnopqrstuvwxyz0123456789';

      //start the final string
      let str = '';
      for (i = 0; i < strLength; i++) {
        // Get a random character from the possibleCharacters string
        var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
        str += randomCharacter;
      }
      return str;
    } else {
      return false;
    }
  }

// Send an sms message via Twilio
helpers.payViaStripe = (amount, callback) => {
  // validate parameters
    amount = typeof(amount) == 'number' && amount > 0 ? amount  : false;
  if(amount) {
    
    // Configure the request payload
    const payload = {
      amount,
      'currency' : 'usd',
      'source' : 'tok_visa'
    };

    // Stringify the payload
    const stringPayload = queryString.stringify(payload);

    //Configure the request details
    const requestDetails = {
      'protocol' : 'https:',
      'hostname' : 'api.stripe.com',
      'method' : 'POST',
      'path' : '/v1/charges',
      'headers' : {
        'Authorization' : `Bearer ${config.stripeKey}`,
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Content-Length' : Buffer.byteLength(stringPayload)
      }
    };

    // Instantiate the request object
    const req = https.request(requestDetails, (res) => {
      // Grab the status of the sent request
      res.setEncoding('utf8');
      const status = res.statusCode;
      // Callback successful if the request went through
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback(`Status code returned was ${status}`);
      }
    });
    // Bind to the error event so it doesn't get thrown
    req.on('error', (e) => {
      console.log('there is error');
      callback(e);
    });
 
    // Add the payload
    req.write(stringPayload);

    // End request
    req.end();

  } else {
    callback('Given parameters were missing of invalid');
  }
};


// Send an sms message via Twilio
helpers.sendMail = (email, msg, callback) => {
  // validate parameters
    msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <=1600 ? msg.trim() : false;
    email = typeof(email) == 'string' && email.trim().length > 0 && email.trim().indexOf('@') > -1 ? email.trim() : false;
  if(msg && email) {
    
    // Configure the request payload
    const payload = {
      'from' : 'Boobaloooo Pizza <transaction@booobaloopizza.com>',
      'to' : email,
      'subject' : 'Order details',
      'text' : msg
    };

    // Stringify the payload
    const stringPayload = queryString.stringify(payload);

    //Configure the request details
    const requestDetails = {
      'protocol' : 'https:',
      'hostname' : 'api.mailgun.net',
      'method' : 'POST',
      'path' : '/v3/sandbox6609d73ecb2e4248bcb27c5ac7afbc5b.mailgun.org/messages',
      'auth' : config.mailgunKey,
      'headers' : {
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Content-Length' : Buffer.byteLength(stringPayload)
      }
    };

    // Instantiate the request object
    const req = https.request(requestDetails, (res) => {
      // Grab the status of the sent request
      const status = res.statusCode;
      // Callback successful if the request went through
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback(`Status code returned was ${status}`);
      }
    });
    // Bind to the error event so it doesn't get thrown
    req.on('error', (e) => {
      console.log('there is error');
      callback(e);
    });
 
    // Add the payload
    req.write(stringPayload);

    // End request
    req.end();

  } else {
    callback('Given parameters were missing of invalid');
  }
};
// Export the module
module.exports = helpers;