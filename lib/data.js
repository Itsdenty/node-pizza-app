/*
* Library for storing and editing data
*
*/

// Dependencies
const fs = require('fs'),
  helpers = require('./helpers'),
  path = require('path');

// Container for the module (to be exported)
const lib = {};

// Base directory of the data folder
lib.baseDir = path.join(__dirname, '/../.data/');

// Write data to a file
lib.create = (dir, file, data, callback) => {
  // Open the file for writing
  fs.open(`${lib.baseDir+dir}/${file}.json`, 'wx', (err, fileDescriptor) => {
    if(!err && fileDescriptor) {
      // Convert data to string
      const stringData = JSON.stringify(data);

      // Write to file and close it
      fs.writeFile(fileDescriptor, stringData, (err) => {
        if(!err) {
          fs.close(fileDescriptor, (err) => {
            if(!err) {
              callback(false);
            } else {
              callback('Error closing new file');
            }
          })
        } else {
          callback('Error writing to new file');
        }
      })
    } else {
      console.log(err);
      callback('Could not create new file, it may already exist');
    }
  });
}


// Read data from a file
lib.read = (dir, file, callback) => {
  fs.readFile(`${lib.baseDir+dir}/${file}.json`, 'utf8', (err, data) => {
    if(!err && data) {
      const parsedData = helpers.parseJsonToObject(data);
      callback(false, parsedData);
    } else {
      callback(err, data);
    }
  })
}

// Update data inside a file
lib.update = function(dir,file,data,callback) {
  // Open the file for writing
  fs.open(`${lib.baseDir+dir}/${file}.json`, 'r+', (err, fileDescriptor) =>{
    if(!err && fileDescriptor) {
      // Convert the data to string
      const stringData = JSON.stringify(data);

      //Truncate the file
      fs.truncate(fileDescriptor, (err) => {
        if(!err) {
          // Write to the file and close it
          fs.writeFile(fileDescriptor, stringData, (err) => {
            if(!err) {
              fs.close(fileDescriptor, (err) => {
                if(!err) {
                  callback(false);
                } else {
                  callback('There was an error whiel closing the file')
                }
              })
            } else {
              callback('Error writing to existing file');
            }
          })
        }
      })
    } else {
      callback('Could not open the file, or it may not exist');
    }
  })
}


// Delete a file
lib.delete = function(dir, file, callback) {
  // Unlink the file
  fs.unlink(`${lib.baseDir+dir}/${file}.json`, (err) => {
    if (!err) {
      callback(null);
    } else {
      callback('Error while deleting the data');
    }
  });
}

// List all the items in a directory
lib.list = (dir, callback) => {
  fs.readdir(`${lib.baseDir + dir}/`, (err, data) => {
    if(!err && data && data.length > 0) {
      const trimmedFileNames = [];
      data.forEach((fileName) => {
        trimmedFileNames.push(fileName.replace('.json', ''));
      });
      callback(false, trimmedFileNames);
    } else {
      callback(500)
    }
  })
}


// Export the module
module.exports = lib;