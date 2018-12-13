/*
* Request handlers
*
*/

// Dependencies
const _data = require('./data'),
  libItems = require('./items')
  helpers = require('./helpers');


//Define handlers
const handlers = {}
  
  // Items handler
  handlers.items = (data, callback) => {
    // Return the items object in item.js
    const items = libItems;

    callback(200, {items});
  };

  // Order handler
  handlers.order = (data, callback) => {
    // get the token from header object
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    if(token) {
    //verify that the given token is valid
    _data.read('tokens', token, (err, tokenData) => {
      if(!err && data) {
        const userEmail = tokenData.email;
        // lookup the userdata
        _data.read('users', userEmail, (err, userData) => {
          if(!err && userData) {
            const userCarts = typeof(userData.carts) == 'object' && userData.carts instanceof Array ? userData.carts : [];
            if(userCarts.length > 0) {
              // retrieve the last cart id
              lastCart = `${Math.max(...userCarts)}`;
              _data.read('carts', lastCart, (err, cartData) => {

                // retrieve the last cart details
                if(!err && cartData) {

                  // if the cart is active proceed to order
                  if (cartData.status == 'active') {
                    const items = libItems,
                      itemObj = {};
                    let totalAmount = 0,
                      totalQuantity = 0,
                      emailMsg = `Dear ${userData.customerName},\nHere is your receipt for the pizza you ordered on our site\n`;
                    items.forEach((item) => {
                      itemObj[`${item.id}`] = item;
                    });
                    cartData.items.forEach((itm) => {
                      const currentItem = itemObj[itm.id];
                      totalAmount += currentItem.price * itm.quantity;
                      totalQuantity += itm.quantity;
                      emailMsg += `${itm.quantity} quantities of ${currentItem.name} at ${currentItem.price} USD each\n`;
                    });
                    emailMsg += `Total Quantity of ordered pizza is: ${totalQuantity} at a total price of ${totalAmount} USD`;

                    // initiate payment
                    helpers.payViaStripe(totalAmount, (err) => {
                      if(!err) {
                        // change cart status to closed
                        cartData.status = 'closed';

                    // Store the new updates
                    _data.update('carts', lastCart, cartData, (err) => {
                      if(!err) {
                        callback(200);

                        // send order details to user
                        helpers.sendMail(userEmail, emailMsg, (err) => {
                          if(!err) {
                            console.log('\x1b[32m%s\x1b[0m', 'email sent successfully');
                          } else {
                            console.log('\x1b[31m%s\x1b[0m', 'email not sent successfully');
                          }
                        });
                      } else {
                        callback(500,{'Error' : 'Could not update cart'});
                      }
                    });
                      } else {
                        callback(500, {'Error' :  'unable to make order payment'});
                      }
                    })
                  } else {
                    callback(403, {'Error' : 'Your cart is empty, please create a new cart'});
                  }
                } else {
                  callback(500, {'Error' : 'Could not retrieve your order details'});
                }
              });
            } else {
              callback(403, {'Error' : 'You haven\'t created a cart at all kindly create a new one'})
            }
          } else {
            callback({'Error' : 'Invalid token provided'});
          }
        })
      } else {
            callback(500, {'Error' : 'An error occured while creating your car'});
          }
      });
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
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
                // Delete all of the user carts
                const userCarts = typeof(userData.carts) == 'object' && userData.carts instanceof Array ? userData.carts : [],
                  cartsToDelete = userCarts.length;
                  if(cartsToDelete > 0) { 
                    let cartsDeleted = 0,
                      deletionErrors = 0;
                    // Loop through carts
                    userCarts.forEach((cartId) => {
                      // Delete the carts
                      _data.delete('carts', cartId, (err) => {
                        if(err) {
                          deletionErrors = true;
                        }
                        cartsDeleted++;
                        if(cartsDeleted == cartsToDelete) {
                          if(!deletionErrors) {
                            callback(200)
                          } else {
                            callback(500, {'Error' : 'An error ocuured, one of the user carts might not have deleted succesfully'})
                          }
                        }
                      })
                    })
                  } else {
                    callback(200);
                  }
              } else {
                callback(500, {'Error' : 'Could not delete the specified user'});
              }
            })
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
      var acceptableMethods = ['post', 'delete'];
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
            const expires = Date.now() + 1000 * 60 * 60 * 24,
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

  // Carts
  handlers.carts = function(data, callback){
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
      handlers._carts[data.method](data,callback);
    } else {
      callback(405);
    }
  }

  // Container for all the cart methods
  handlers._carts = {};

  // Carts - post
  // Required data : items
  // Optional data: none
  handlers._carts.post = (data, callback) => {
    const items = typeof(data.payload.items) == 'object' && data.payload.items instanceof Array && data.payload.items.length > -1 ? data.payload.items : false;
    if(items) {
      // Get the token from the header
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      //verify that the given token is valid
      _data.read('tokens', token, (err, tokenData) => {
        if(!err && data) {
          const userEmail = tokenData.email,
           cartId = Date.now();
           cartObject = {
            items,
            'status' : 'active',
            userEmail
          };
      
          // lookup the userdata
          _data.read('users', userEmail, (err, userData) => {
            if(!err && userData) {
              const userCarts = typeof(userData.carts) == 'object' && userData.carts instanceof Array ? userData.carts : [];
              if(userCarts.length > 0) {
                // retrieve the last cart id
                lastCart = `${Math.max(...userCarts)}`;
                _data.read('carts', lastCart, (err, cartData) => {

                  // retrieve the last cart details
                  if(!err && cartData) {
                    if (cartData.status == 'active') {
                      callback(403, {'Error' : 'You have an active cart kindly use it to place your order or destroy it before creating another'});
                    } else {
                      // save the object
                      _data.create('carts', cartId, cartObject, (err) => {
                        if(!err) {
                          // Add the cart to the userobject
                          userData.carts = userCarts;
                          userData.carts.push(cartId);

                          // save the new user data
                          _data.update('users', userEmail, userData, (err) => {
                            if(!err) {
                              // Return the data about the new cart
                              callback(200, cartObject.items);
                            } else {
                              callback(500, {'Error' : 'Could not update the user with the new cart'});
                            }
                          })
                        } else {
                          callback(500, {'Error' : 'Could not create the new cart'});
                        }
                      });
                    }
                  } else {
                    callback(500, {'Error' : 'Could not create the new cart'});
                  }
                });
              } else {
                // save the object the user have never created a cart
                _data.create('carts', cartId, cartObject, (err) => {
                  if(!err) {
                    // Add the cart to the userobject
                    userData.carts = userCarts;
                    userData.carts.push(cartId);

                    // save the new user data
                    _data.update('users', userEmail, userData, (err) => {
                      if(!err) {
                        // Return the data about the new cart
                        callback(200, cartObject.items);
                      } else {
                        callback(500, {'Error' : 'Could not update the user with the new cart'});
                      }
                    })
                  } else {
                    callback(500, {'Error' : 'Could not create the new cart'});
                  }
                });
              }
            } else {
              callback({'Error' : 'Invalid token provided'});
            }
          });
        } else {
          callback(403, {'Error' : 'Token not present on header or invalid token suplied'});
        }
      })
    } else {
      callback(400, {'Error' : 'Missing required inputs or inputs are invalid'});
    }
  }

  // Carts - get
  // Required data: token
  // optional data: none
  handlers._carts.get = function(data,callback) {
    // get the token from header object
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    if(token) {
      //verify that the given token is valid
      _data.read('tokens', token, (err, tokenData) => {
        if(!err && data) {
          const userEmail = tokenData.email;
          // lookup the userdata
          _data.read('users', userEmail, (err, userData) => {
            if(!err && userData) {
              const userCarts = typeof(userData.carts) == 'object' && userData.carts instanceof Array ? userData.carts : [];
              if(userCarts.length > 0) {
                // retrieve the last cart id
                lastCart = `${Math.max(...userCarts)}`;
                _data.read('carts', lastCart, (err, cartData) => {

                  // retrieve the last cart details
                  if(!err && cartData) {
                    if (cartData.status == 'active') {
                      callback(200, cartData.items);
                    } else {
                      callback(403, {'Error' : 'You don\'t have an active cart kindly create a new one'});
                    }
                  } else {
                    callback(500, {'Error' : 'Could not create the new cart'});
                  }
                });
              } else {
                callback(403, {'Error' : 'You haven\'t created a cart at all kindly create a new one'})
              }
            } else {
              callback({'Error' : 'Invalid token provided'});
            }
          });
        } else {
          callback(500, {'Error' : 'An error occured while creating your car'});
        }
      });
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  };

  // Cart - put
  // Required data: token items
  // optional data: none
  handlers._carts.put = function(data,callback) {
    // get the token from header object
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false,
      items = typeof(data.payload.items) == 'object' && data.payload.items instanceof Array && data.payload.items.length > -1 ? data.payload.items : false;
    if(token && items) {
      //verify that the given token is valid
      _data.read('tokens', token, (err, tokenData) => {
        if(!err && data) {
          const userEmail = tokenData.email;
          // lookup the userdata
          _data.read('users', userEmail, (err, userData) => {
            if(!err && userData) {
              const userCarts = typeof(userData.carts) == 'object' && userData.carts instanceof Array ? userData.carts : [];
              if(userCarts.length > 0) {
                // retrieve the last cart id
                lastCart = `${Math.max(...userCarts)}`;
                _data.read('carts', lastCart, (err, cartData) => {

                  // retrieve the last cart details
                  if(!err && cartData) {
                    if (cartData.status == 'active') {
                      cartData.items = items;

                      // Store the new updates
                      _data.update('carts', lastCart, cartData, (err) => {
                        if(!err) {
                          callback(200);
                        } else {
                          callback(500,{'Error' : 'Could not update cart'});
                        }
                      });
                    } else {
                      callback(403, {'Error' : 'You don\'t have an active cart kindly create a new one'});
                    }
                  } else {
                    callback(500, {'Error' : 'Could not create the new cart'});
                  }
                });
              } else {
                callback(403, {'Error' : 'You haven\'t created a cart at all kindly create a new one'})
              }
            } else {
              callback({'Error' : 'Invalid token provided'});
            }
          })
        } else {
          callback(500, {'Error' : 'An error occured while creating your car'});
        }
      });
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  };


  // Cart - delete
  // Required data: token
  // optional data: none
  handlers._carts.delete = function(data,callback) {
    // get the token from header object
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    if(token) {
      //verify that the given token is valid
      _data.read('tokens', token, (err, tokenData) => {
        if(!err && data) {
          const userEmail = tokenData.email;
          // lookup the userdata
          _data.read('users', userEmail, (err, userData) => {
            if(!err && userData) {
              const userCarts = typeof(userData.carts) == 'object' && userData.carts instanceof Array ? userData.carts : [];
              if(userCarts.length > 0) {
                // retrieve the last cart id
                lastCart = `${Math.max(...userCarts)}`;
                _data.read('carts', lastCart, (err, cartData) => {

                  // retrieve the last cart details
                  if(!err && cartData) {
                    if (cartData.status == 'active') {

                      // Delete the cartData
                      _data.delete('carts', lastCart, (err) => {
                        if(!err) {
                          const userCarts = typeof(userData.carts) == 'object' && userData.carts instanceof Array ? userData.carts : [];
                          console.log(userData, lastCart, userCarts.indexOf(parseInt(lastCart)));
                          // Remove the user cart from the list of carts
                          const cartPosition = userCarts.indexOf(parseInt(lastCart));
                          if(cartPosition > -1) {
                            userCarts.splice(cartPosition, 1);
                            userData.carts = userCarts;
                            
                            // save the user data
                            _data.update('users', userEmail, userData, (err) => {
                              if(!err) {
                                callback(200);
                              } else {
                                callback(500, {'Error' : 'Could not update the specified user'});
                              }
                            })
                          } else {
                            callback(500, {'Error' : 'Could not find the cart object on the user object so cannot remove it'})
                          }
                        } else {
                          callback(500, {'Error' : 'Could not delete the cart data'})
                        }
                      })
                    } else {
                      callback(403, {'Error' : 'You don\'t have an active cart kindly create a new one'});
                    }
                  } else {
                    callback(500, {'Error' : 'You do not have an active cart'});
                  }
                });
              } else {
                callback(403, {'Error' : 'You haven\'t created a cart at all kindly create a new one'})
              }
            } else {
              callback({'Error' : 'Invalid token provided'});
            }
          })
        } else {
          callback(500, {'Error' : 'An error occured while creating your car'});
        }
      });
    } else {
      callback(400, {'Error' : 'Missing required field'})
    }
  };

  // Not found handler
  handlers.notFound = (data, callback) => {
    callback(404);
  };

  // Export the module
  module.exports = handlers;