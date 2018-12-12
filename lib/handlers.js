/*
* Request handlers
*
*/

// Dependencies
const _data = require('./data'),
  config = require('./config'),
  helpers = require('./helpers');


//Define handlers
const handlers = {}
  
  //ping handler
  handlers.ping = (data, callback) => {
    // Callback a http status code, and payload object
    callback(200);
  };

  // Users
  handlers.users = function(data, callback){
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
      handlers._users[data.method](data,callback);
    } else {
      callback(405);
    }
  }

  // Container for the users submethods
  handlers._users = {};

  // Users - post
  // Required data: customerName, address, email, password
  // Optional data: none
  handlers._users.post = function(data,callback) {
    // Check that all required fields are filled out
    const customerName = typeof(data.payload.customerName) == 'string' && data.payload.customerName.trim().length > 0 ? data.payload.customerName.trim() : false,
      address = typeof(data.payload.address) == 'string' && data.payload.address.trim().length > 0 ? data.payload.address.trim() : false,
      email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && data.payload.email.trim().indexOf('@') > -1 ? data.payload.email.trim() : false,
      password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
      if(customerName && address && email && password){
        // Make sure that the user doesn't already exist
        _data.read('users', email, (err, data) => {
          if(err) {
            // Hash the password
            const hashedPassword = helpers.hash(password);
            if(hashedPassword) {
              // Create the user object
              const userObject = {
                customerName,
                address,
                email,
                hashedPassword,
              }

              // Store user
              _data.create('users', email, userObject, (err) => {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, 'Could not create the new user');
                }
              });
            } else {
              callback(500, {'Error' : 'Could not hash the user\'s password'});
            }
          } else {
            // User already exist
            callback(400, {'Error' : 'A user with that email address already exists'});
          }
        })
      } else {
        callback(400, {'Error' : 'Missing required fields'});
      }
  };

  // Users - get
  // Required data: email
  // Optional data: none
    handlers._users.get = function(data,callback) {
    // check the email is valid
    const email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().indexOf('@') > -1 ? data.queryStringObject.email.trim() : false;
    if(email) {
      // get the token from the user
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      //verify that the given token is valid for the email
      handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
        if(tokenIsValid) {
          // look up the user
          _data.read('users', email, (err,data) => {
            if(!err && data) {
              // Remove hash password from the user object before returning it
              delete data.hashedPassword;
              callback(200, data);
            }
            else {
              callback(404, {'Error' : 'Could not find the specified user'});
            }
          })
        } else {
          callback(403, {'Error' : 'Token not present on header or invalid token suplied'});
        }
      });
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  };

  // Users - put
  // Required data: email
  // Optional data: customerName, address, password (atleast one must be specified)
  handlers._users.put = function(data,callback) {
    // Check for the required field
    const email = typeof(data.payload.email) == 'string' && data.payload.email.trim().indexOf('@') > -1 ? data.payload.email.trim() : false;

    // Check for the optional field
    const customerName = typeof(data.payload.customerName) == 'string' && data.payload.customerName.trim().length > 0 ? data.payload.customerName.trim() : false,
    address = typeof(data.payload.address) == 'string' && data.payload.address.trim().length > 0 ? data.payload.address.trim() : false,
    password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    // Error if the email is invalid
    if(email) {
      console.log(email);
      // Error if nothing is sent to update
      if(customerName || address || password) {
      // get the token from the user
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      //verify that the given token is valid for the email
      handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
        if(tokenIsValid) { 
        // lookup the user
          _data.read('users', email, (err, userData) => {
            if (!err && userData) {
              // update the fields necessary
              if(customerName) {
                userData.customerName = customerName;
              }
              if(address) {
                userData.address = address;
              }
              if(password) {
                userData.hashedPassword = helpers.hash(password);
              }

              // Store the new updates
              _data.update('users', email, userData, (err) => {
                if(!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback({'Error' : 'Could not update the user'})
                }
              })
            } else {
              callback(400, {'Error' : 'The specified user does not exist'})
            }
          })
        } else {
          callback(403, {'Error' : 'Token not present on header or invalid token suplied'});
        }
      });
      } else {
        callback(400, {'Error' : 'Missing fields to update'});
      }
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  };

  // Users - delete
  // Required data: email
  // Optional data: none
  handlers._users.delete = function(data,callback) {
    // check the email is valid
    const email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().indexOf('@') > -1 ? data.queryStringObject.email.trim() : false;
    if(email) {
      // get the token from the user
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      //verify that the given token is valid for the email
      handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
        if(tokenIsValid) { 
        // look up the user
        _data.read('users', email, (err, userData) => {
          if(!err && data) {
            _data.delete('users', email, (err) => {
              if(!err) {
              // @Todo user orders
              //   // Delete all of the user checks
              //   const userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [],
              //     checksToDelete = userChecks.length;
              //     if(checksToDelete > 0) { 
              //       let checkDeleted = 0,
              //         deletionErrors = 0;
              //       // Loop through checks
              //       userChecks.forEach((checkId) => {
              //         // Delete the checks
              //         _data.delete('checks', checkId, (err) => {
              //           if(err) {
              //             deletionErrors = true;
              //           }
              //           checkDeleted++;
              //           if(checkDeleted == checksToDelete) {
              //             if(!deletionErrors) {
              //               callback(200)
              //             } else {
              //               callback(500, {'Error' : 'An error ocuured, all of the user checks  might not have deleted succesfully'})
              //             }
              //           }
              //         })
              //       })
              //     } else {
              //       callback(200);
              //     }
                callback(200);
              } else {
                callback(500, {'Error' : 'Could not delete the specified user'});
              }
            })
            callback(200);
          }
          else {
            callback(404, {'Error' : 'Could not find the specified user'});
          }
        });
      } else {
        callback(403, {'Error' : 'Token not present on header or invalid token suplied'});
      }
    });
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  };

    // Tokens
    handlers.tokens = function(data, callback){
      var acceptableMethods = ['post', 'get', 'put', 'delete'];
      if(acceptableMethods.indexOf(data.method) > -1){
        handlers._tokens[data.method](data,callback);
      } else {
        callback(405);
      }
    }

    // Containere for all the token methods
    handlers._tokens = {};

    // Tokens - posta 
    // Required data : email, password
    // optional data : none
    handlers._tokens.post = (data, callback) => {
      const email = typeof(data.payload.email) == 'string' && data.payload.email.trim().indexOf('@') > -1 ? data.payload.email.trim() : false,
        password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
      if(email && password) {
        // Look up the user who matches that email
        _data.read('users', email, (err, userData) => {
          if(!err && userData) {
            // hash the sent password and compare it to the password sent in the user request
            const hashedPassword = helpers.hash(password)
            if(hashedPassword == userData.hashedPassword) {
              // if valid, creat a new token with a random name, set expiration data 1 hour in the future
              tokenId = helpers.createRandomString(20);
              const expires = Date.now() + 1000 * 60 * 60,
                tokenObject = {
                  email,
                  id : tokenId,
                  expires
                }

              // Store the token
              _data.create('tokens', tokenId, tokenObject, (err) => {
                if(!err) {
                  callback(200, tokenObject);
                } else {
                  callback(500, {'Error' : 'Could not create token'});
                }
              })
              
            } else {
              callback(400, {'Error' : 'Password do not match the specified user stored password'});
            }
          }
        });


      } else {
        callback(404, {'Error' : 'Missing required fields'})
      }
    
    };

    // Tokens - get
    // Required data : id
    // Optional data: none
    handlers._tokens.get = (data, callback) => {
    // check that the id is valid
    const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id) {
      // look up the user
      _data.read('tokens', id, (err, tokenData) => {
        if(!err && tokenData) {
          callback(200, tokenData);
        }
        else {
          callback(404, {'Error' : 'Could not find the specified token'});
        }
      })

    } else {
      callback(400)
    }
  };

    // Tokens - put
    // Required data: id, extend
    // opional data none
    handlers._tokens.put = (data, callback) => {
      const id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false,
        extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
      if(id && extend) {
        // Look up the token
        _data.read('tokens', id, (err, tokenData) => {
          if(!err && tokenData) {
            if(tokenData.expires > Date.now()){
              // Set the expiration an hour from now
              tokenData.expires = Date.now() + 1000 * 60 * 60;
  
              // Store the new update
              _data.update('tokens', id, tokenData, (err) => {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, {'Error' : 'Could not update the token\'s expiration'});
                }
              })
            } else {
              carllback(400, {'Erro' : 'Token has alredy expired and cannot be extended'});
            }
          } else {
            callback(400, {'Error' : 'Specified token does not exist'})
          }
        })
      } else {
        callback(400, {'Error' : 'Missing required fields or field(s) are invalid'});
      }
    };

    // Tokens - delete
    // Required data: id
    // Optional data: none
    handlers._tokens.delete = (data, callback) => {
      // check the id is valid
      const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
      if(id) {
        // look up the user
        _data.read('tokens', id, (err,data) => {
          if(!err && data) {
            _data.delete('tokens', id, (err) => {
              if(!err) {
                callback(200);
              } else {
                callback(500, {'Error' : 'Could not delete the specified token'});
              }
            })
            callback(200);
          }
          else {
            callback(404, {'Error' : 'Could not find the specified token'});
          }
        });

      } else {
        callback(400, {'Error' : 'Missing required field'})
      }
    };

  // Verify if a given token id is currently valid for a given user
  handlers._tokens.verifyToken = (id, email, callback) => {
    _data.read('tokens', id, function(err, tokenData) {
      if(!err && tokenData) {
        // check that the token is for the given user and has not expired
        if(tokenData.email == email && tokenData.expires > Date.now()) {
          callback(true);
        } else {
          callback(false);
        }
      } else {
        callback(false);
      }
    })
  }

  // Checks
  handlers.checks = function(data, callback){
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
      handlers._checks[data.method](data,callback);
    } else {
      callback(405);
    }
  }

  // Container for all the checks methods
  handlers._checks = {};

  // Checks - post
  // Required data : protocol, url, method, successCodes , timeoutSeconds
  // Optional data: none
  handlers._checks.post = (data, callback) => {
    const protocol = typeof(data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false,
      url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false,
      method = typeof(data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false,
      successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > -1 ? data.payload.successCodes : false,
      timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <=5 ? data.payload.timeoutSeconds : false;
    if(protocol && url && method && successCodes && timeoutSeconds) {
      // Get the token from the header
      // get the token from the user
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      //verify that the given token is valid for the phone number
      _data.read('tokens', token, (err, tokenData) => {
        if(!err && data) {
          const userPhone = tokenData.phone;

          // lookup the userdata
          _data.read('users', userPhone, (err, userData) => {
            if(!err && userData) {
              const userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
              if( userChecks.length < config.maxChecks) {
                // create a random id for the check
                const checkId = helpers.createRandomString(20);
 
                // Create the check object, and include the user's phone
                const checkObject = {
                  'id' : checkId,
                  userPhone,
                  url,
                  method,
                  successCodes,
                  protocol,
                  timeoutSeconds
                }
                // save the object
                _data.create('checks', checkId, checkObject, (err) => {
                  if(!err) {
                    // Add the check to the userobject
                    userData.checks = userChecks;
                    userData.checks.push(checkId);

                    // save the new user data
                    _data.update('users', userPhone, userData, (err) => {
                      if(!err) {
                        // Return the data about the new check
                        callback(200, checkObject);
                      } else {
                        callback(500, {'Error' : 'Could not update the user with the new check'});
                      }
                    })
                  } else {
                    callback(500, {'Error' : 'Could not create the new check'});
                  }
                })
              } else {
                callback(400, {'Error' : `The user already has the maximum number of checks (${config.maxChecks})`})
              }
            } else {
              callback(403);
            }
          })
        } else {
          callback(403, {'Error' : 'Token not present on header or invalid token suplied'});
        }
      })
    } else {
      console.log(protocol, url, method, successCodes, timeoutSeconds);
      callback(400, {'Error' : 'Missing required inputs or inputs are invalid'});
    }
  }

  // Check - get
  // Required data: id
  // optional data: none
  handlers._checks.get = function(data,callback) {
    // check the id is valid
    const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id) {
      // get the token from the user
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
      // Lookup the check
      _data.read('checks', id, (err, checkData) => {
        if(!err && checkData) {
          //verify that the given token is valid and belongs to the user that created the check
          handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) => {
            if(tokenIsValid) {
              // return check data
              callback(200, checkData);
            } else {
              callback(403);
            }
          });
        } else {
          callback(404)
        }
      })
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  };

  // checks - put
  // Require data: protocol, url, method, successCodes, timeoutSeconds (at least one must be provided)
  // Optional data: none
  handlers._checks.put = (data, callback) => {
    // Check for the required field
    const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;

    // Optional field
    const protocol = typeof(data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false,
    url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false,
    method = typeof(data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false,
    successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > -1 ? data.payload.successCodes : false,
    timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <=5 ? data.payload.timeoutSeconds : false;
    if (id) {
      if(protocol || url || method || successCodes || timeoutSeconds) {
        _data.read('checks', id, (err, checkData) => {
          if(!err && checkData) {
            // get the token from the user
            const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
          //verify that the given token is valid and belongs to the user that created the check
          handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) => {
            if(tokenIsValid) {
              if(protocol) {
                checkData.protocol = protocol;
              }
              if(url) {
                checkData.url = url;
              }
              if(method) {
                checkData.method = method;
              }
              if(successCodes) {
                checkData.successCodes = successCodes;
              }
              if(timeoutSeconds) {
                checkData.timeoutSeconds = timeoutSeconds;
              }

              // Store the new updates
              _data.update('checks', id, checkData, (err) => {
                if(!err) {
                  callback(200);
                } else {
                  callback(500,{'Error' : 'Could not update check'});
                }
              })
              
            } else {
              callback(403);
            }
          });
          } else {
            callback(400, {'Error' : 'Check ID did not exist'});
          }
        })
      } else {
        callback(400, {'Error' : 'Missing field to update'})
      }
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  };
  
  // Checks - delete
  // Required data: id
  // Optional data: none
  handlers._checks.delete = (data, callback) => {
    // check the id is valid
    const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id) {
      // Lookup check
      _data.read('checks', id, (err, checkData ) => {
        if(!err && checkData) {
                  // get the token from the user
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      //verify that the given token is valid for the phone number
      handlers._tokens.verifyToken(token, checkData.userPhone, (tokenIsValid) => {
        if(tokenIsValid) { 

        // Delete the checkData
        _data.delete('checks', id, (err) => {
          if(!err) {
            // look up the user
            _data.read('users', checkData.userPhone, (err,data) => {
              if(!err && data) {
                const userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                // Remove the user check from the list of check
                const checkPosition = userData.indexOf(id);
                if(checkPosition > -1) {
                  userChecks.splice(checkPosition, 1);
                  // save the user data
                  _data.update('users', checkData.userPhone, userData, (err) => {
                    if(!err) {
                      callback(200);
                    } else {
                      callback(500, {'Error' : 'Could not update the specified user'});
                    }
                  })
                } else {
                  callback(500, {'Error' : 'Could not find the check object on the user object so cannot remove it'})
                }
                callback(200);
              }
              else {
                callback(404, {'Error' : 'Could not find the specified user, so could not remove the check data from the user object'});
              }
            });  
          } else {
            callback(500, {'Error' : 'Could not delete the check data'})
          }
        })
      } else {
        callback(403);
      }
    });
        } else {
          callback(400, {'Error' : 'The specified check id does not exist'});
        }        
      })
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  } 

  //not found handler
  handlers.notFound = (data, callback) => {
    callback(404);
  };

  // Export the module
  module.exports = handlers;